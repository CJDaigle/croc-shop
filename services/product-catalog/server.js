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

const seedProducts = [
  { id: 1, name: 'Classic Clog', price: 49.99, description: 'The iconic Crocs comfort clog', stock: 50, category: 'footwear' },
  { id: 2, name: 'Classic Lined Clog', price: 59.99, description: 'Cozy lined comfort for colder days', stock: 30, category: 'footwear' },
  { id: 3, name: 'LiteRide 360 Clog', price: 69.99, description: 'Softer, lighter, all-day comfort', stock: 20, category: 'footwear' },
  { id: 4, name: 'Jibbitz Charms Pack', price: 14.99, description: 'Personalize your Crocs with charms', stock: 100, category: 'accessories' },
  { id: 5, name: 'All-Terrain Clog', price: 64.99, description: 'Rugged outsole for extra traction', stock: 75, category: 'footwear' },
  { id: 6, name: 'Baya Clog', price: 44.99, description: 'Lightweight clog with classic ventilation', stock: 60, category: 'footwear' },
  { id: 7, name: 'Crocband Clog', price: 49.99, description: 'Sporty band style with cushioned comfort', stock: 55, category: 'footwear' },
  { id: 8, name: 'Classic Platform Clog', price: 54.99, description: 'A little extra height with the same comfort', stock: 40, category: 'footwear' },
  { id: 9, name: 'Classic Slide', price: 29.99, description: 'Easy slip-on slide for everyday wear', stock: 70, category: 'footwear' },
  { id: 10, name: 'Classic Sandal', price: 34.99, description: 'Two-strap sandal with soft footbed', stock: 65, category: 'footwear' },
  { id: 11, name: 'Echo Clog', price: 79.99, description: 'Bold design with all-day cushioning', stock: 25, category: 'footwear' },
  { id: 12, name: 'Mellow Recovery Slide', price: 39.99, description: 'Recovery-focused softness and support', stock: 35, category: 'footwear' },
  { id: 13, name: 'LiteRide Slide', price: 44.99, description: 'Plush foam footbed for summer comfort', stock: 45, category: 'footwear' },
  { id: 14, name: 'Classic Fur Sure Clog', price: 64.99, description: 'Fuzzy-lined comfort with classic shape', stock: 28, category: 'footwear' },
  { id: 15, name: 'Classic Cozzzy Sandal', price: 49.99, description: 'Soft strap sandal for lounging and errands', stock: 38, category: 'footwear' },
  { id: 16, name: 'Classic Boot', price: 89.99, description: 'Weather-ready boot with Crocs comfort', stock: 15, category: 'footwear' },
  { id: 17, name: 'Rain Boot', price: 74.99, description: 'Lightweight rain boot for wet days', stock: 18, category: 'footwear' },
  { id: 18, name: 'Jibbitz Letter Charms', price: 9.99, description: 'Spell it out with letter charms', stock: 120, category: 'accessories' },
  { id: 19, name: 'Jibbitz Glow Charms', price: 12.99, description: 'Glow-in-the-dark charms for night fun', stock: 90, category: 'accessories' },
  { id: 20, name: 'Jibbitz Sports Charms', price: 11.99, description: 'Sports-themed charms for fans', stock: 80, category: 'accessories' },
  { id: 21, name: 'Classic Socks', price: 16.99, description: 'Soft crew socks that pair perfectly with clogs', stock: 75, category: 'apparel' },
  { id: 22, name: 'Cozy Slipper', price: 54.99, description: 'Indoor slipper with plush lining', stock: 22, category: 'footwear' },
  { id: 23, name: 'Travel Tote', price: 24.99, description: 'Simple tote bag for daily essentials', stock: 50, category: 'accessories' },
  { id: 24, name: 'Waterproof Shoe Spray', price: 13.99, description: 'Helps repel water and stains', stock: 85, category: 'care' },
  { id: 25, name: 'Cleaning Kit', price: 19.99, description: 'Brush and cleaner for easy maintenance', stock: 65, category: 'care' },
  { id: 26, name: 'Fuzzy Lined Slide', price: 42.99, description: 'Warm slide with soft fuzzy lining', stock: 27, category: 'footwear' },
  { id: 27, name: 'Kids Classic Clog', price: 34.99, description: 'Kid-sized classic comfort and durability', stock: 90, category: 'footwear' },
  { id: 28, name: 'Kids Jibbitz Variety Pack', price: 15.99, description: 'A fun variety pack for kids', stock: 110, category: 'accessories' },
  { id: 29, name: 'All-Day Comfort Insole', price: 21.99, description: 'Extra cushioning for long days', stock: 40, category: 'accessories' },
  { id: 30, name: 'Classic Baseball Cap', price: 22.99, description: 'Everyday cap with simple embroidered logo', stock: 48, category: 'apparel' }
];

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      description TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT
    );
  `);
}

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (rows[0].count > 0) return;

  const values = [];
  const placeholders = [];
  let i = 1;

  for (const p of seedProducts) {
    placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    values.push(p.id, p.name, p.price, p.description, p.stock, p.category);
  }

  await pool.query(
    `INSERT INTO products (id, name, price, description, stock, category)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (id) DO NOTHING`,
    values
  );

  await pool.query(
    `SELECT setval(
      pg_get_serial_sequence('products', 'id'),
      (SELECT COALESCE(MAX(id), 1) FROM products)
    )`
  );
}

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
    const params = [];
    let sql = 'SELECT id, name, price::float8 AS price, description, stock, category FROM products';

    if (category) {
      params.push(category);
      sql += ` WHERE category = $${params.length}`;
    }

    sql += ' ORDER BY id ASC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
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

    if (Number.isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      end({ method: 'GET', route: '/api/products/:id', status_code: 400 });
      return;
    }

    const result = await pool.query(
      'SELECT id, name, price::float8 AS price, description, stock, category FROM products WHERE id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      end({ method: 'GET', route: '/api/products/:id', status_code: 404 });
      return;
    }

    res.json(result.rows[0]);
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

    if (!name || price === undefined || stock === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      end({ method: 'POST', route: '/api/products', status_code: 400 });
      return;
    }

    const result = await pool.query(
      'INSERT INTO products (name, price, description, stock, category) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, price::float8 AS price, description, stock, category',
      [name, price, description || null, stock, category || null]
    );

    res.status(201).json(result.rows[0]);
    end({ method: 'POST', route: '/api/products', status_code: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
    end({ method: 'POST', route: '/api/products', status_code: 500 });
  }
});

(async () => {
  try {
    await ensureSchema();
    await seedIfEmpty();
    app.listen(PORT, () => {
      console.log(`Product Catalog Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Product Catalog Service:', error);
    process.exit(1);
  }
})();
