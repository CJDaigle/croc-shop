const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
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

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'crocshop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      shipping_address TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_zip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const cols = [
    { name: 'shipping_address', type: 'TEXT' },
    { name: 'shipping_city', type: 'TEXT' },
    { name: 'shipping_state', type: 'TEXT' },
    { name: 'shipping_zip', type: 'TEXT' }
  ];
  const validTypes = ['TEXT', 'INTEGER', 'BOOLEAN', 'TIMESTAMPTZ', 'NUMERIC'];
  for (const col of cols) {
    if (!/^[a-z_]+$/.test(col.name) || !validTypes.includes(col.type)) {
      throw new Error(`Invalid column definition: ${col.name} ${col.type}`);
    }
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
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
    
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'User already exists' });
      end({ method: 'POST', route: '/api/auth/register', status_code: 409 });
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    const user = result.rows[0];
    
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
    
    const result = await pool.query('SELECT id, email, name, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      end({ method: 'POST', route: '/api/auth/login', status_code: 401 });
      return;
    }
    const user = result.rows[0];
    
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

app.get('/api/users/me', async (req, res) => {
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
    const result = await pool.query(
      'SELECT id, email, name, shipping_address, shipping_city, shipping_state, shipping_zip FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      end({ method: 'GET', route: '/api/users/me', status_code: 404 });
      return;
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      shippingAddress: user.shipping_address,
      shippingCity: user.shipping_city,
      shippingState: user.shipping_state,
      shippingZip: user.shipping_zip
    });
    end({ method: 'GET', route: '/api/users/me', status_code: 200 });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
    end({ method: 'GET', route: '/api/users/me', status_code: 401 });
  }
});

app.put('/api/users/me/address', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'No token provided' });
      end({ method: 'PUT', route: '/api/users/me/address', status_code: 401 });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { shippingAddress, shippingCity, shippingState, shippingZip } = req.body;

    const result = await pool.query(
      `UPDATE users SET shipping_address = $1, shipping_city = $2, shipping_state = $3, shipping_zip = $4
       WHERE id = $5
       RETURNING id, email, name, shipping_address, shipping_city, shipping_state, shipping_zip`,
      [shippingAddress, shippingCity, shippingState, shippingZip, decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      end({ method: 'PUT', route: '/api/users/me/address', status_code: 404 });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      shippingAddress: user.shipping_address,
      shippingCity: user.shipping_city,
      shippingState: user.shipping_state,
      shippingZip: user.shipping_zip
    });
    end({ method: 'PUT', route: '/api/users/me/address', status_code: 200 });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'PUT', route: '/api/users/me/address', status_code: 500 });
  }
});

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`User Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start User Service:', error);
    process.exit(1);
  }
})();
