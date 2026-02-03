const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const promClient = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const users = [];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user' });
});

app.get('/ready', (req, res) => {
  res.json({ status: 'ready' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/api/auth/register', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      end({ method: 'POST', route: '/api/auth/register', status_code: 400 });
      return;
    }
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      end({ method: 'POST', route: '/api/auth/register', status_code: 409 });
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString()
    };
    
    users.push(user);
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
    end({ method: 'POST', route: '/api/auth/register', status_code: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'POST', route: '/api/auth/register', status_code: 500 });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Missing credentials' });
      end({ method: 'POST', route: '/api/auth/login', status_code: 400 });
      return;
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      end({ method: 'POST', route: '/api/auth/login', status_code: 401 });
      return;
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      end({ method: 'POST', route: '/api/auth/login', status_code: 401 });
      return;
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
    end({ method: 'POST', route: '/api/auth/login', status_code: 200 });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'POST', route: '/api/auth/login', status_code: 500 });
  }
});

app.get('/api/users/me', (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'No token provided' });
      end({ method: 'GET', route: '/api/users/me', status_code: 401 });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      end({ method: 'GET', route: '/api/users/me', status_code: 404 });
      return;
    }
    
    res.json({ id: user.id, email: user.email, name: user.name });
    end({ method: 'GET', route: '/api/users/me', status_code: 200 });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
    end({ method: 'GET', route: '/api/users/me', status_code: 401 });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
