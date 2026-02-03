const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const promClient = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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
  database: process.env.DB_NAME || 'crockshop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

const products = [
  { id: 1, name: 'Classic Crock Pot', price: 49.99, description: 'Traditional slow cooker', stock: 50, category: 'cookware' },
  { id: 2, name: 'Instant Pot Duo', price: 89.99, description: 'Multi-function pressure cooker', stock: 30, category: 'cookware' },
  { id: 3, name: 'Ceramic Dutch Oven', price: 129.99, description: 'Premium enamel cast iron', stock: 20, category: 'cookware' },
  { id: 4, name: 'Slow Cooker Liner', price: 9.99, description: 'Disposable cooking bags', stock: 100, category: 'accessories' },
  { id: 5, name: 'Recipe Book Bundle', price: 24.99, description: 'Collection of slow cooker recipes', stock: 75, category: 'books' }
];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'product-catalog' });
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

app.get('/api/products', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const { category } = req.query;
    let filteredProducts = products;
    
    if (category) {
      filteredProducts = products.filter(p => p.category === category);
    }
    
    res.json(filteredProducts);
    end({ method: 'GET', route: '/api/products', status_code: 200 });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'GET', route: '/api/products', status_code: 500 });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      end({ method: 'GET', route: '/api/products/:id', status_code: 404 });
      return;
    }
    
    res.json(product);
    end({ method: 'GET', route: '/api/products/:id', status_code: 200 });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'GET', route: '/api/products/:id', status_code: 500 });
  }
});

app.post('/api/products', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const { name, price, description, stock, category } = req.body;
    const newProduct = {
      id: products.length + 1,
      name,
      price,
      description,
      stock,
      category
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
    end({ method: 'POST', route: '/api/products', status_code: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'POST', route: '/api/products', status_code: 500 });
  }
});

app.listen(PORT, () => {
  console.log(`Product Catalog Service running on port ${PORT}`);
});
