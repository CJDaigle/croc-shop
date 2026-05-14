import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import promClient from 'prom-client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

const { Pool } = pg;
const HTTP_PORT = Number.parseInt(process.env.PORT || '3006', 10);
const DEFAULT_ROW_LIMIT = Number.parseInt(process.env.MCP_QUERY_ROW_LIMIT || '200', 10);
const MAX_ROW_LIMIT = Number.isFinite(DEFAULT_ROW_LIMIT) && DEFAULT_ROW_LIMIT > 0 ? DEFAULT_ROW_LIMIT : 200;

const registry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number.parseInt(process.env.PGPORT, 10) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

const queryToolSchema = z.object({
  sql: z.string().min(1),
  limit: z.number().int().positive().max(MAX_ROW_LIMIT).optional(),
});

const tableSchema = z.object({
  table: z.string().min(1),
});

const searchProductsSchema = z.object({
  category: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const userByEmailSchema = z.object({
  email: z.string().email(),
});

const orderByIdSchema = z.object({
  orderId: z.number().int().positive(),
});

const productByIdSchema = z.object({
  productId: z.number().int().positive(),
});

const userOrdersSchema = z.object({
  userId: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  limit: z.number().int().positive().max(100).optional(),
}).refine((value) => value.userId || value.email, {
  message: 'Either userId or email is required.',
});

const lowStockProductsSchema = z.object({
  threshold: z.number().int().nonnegative().max(1000).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const recentOrdersSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  status: z.string().min(1).optional(),
});

function formatText(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function createMcpServer() {
  const server = new Server(
    {
      name: 'croc-shop-data-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_schema_summary',
        description: 'Get the public PostgreSQL schema summary for the Croc Shop database.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_tables',
        description: 'List public PostgreSQL tables available in the Croc Shop database.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'describe_table',
        description: 'Describe the columns for a public PostgreSQL table.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'run_readonly_query',
        description: 'Run a single read-only SQL query against Croc Shop PostgreSQL. Only SELECT, WITH, and EXPLAIN are allowed.',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: MAX_ROW_LIMIT,
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'search_products',
        description: 'Search products by category and optional free-text match on name or description.',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            search: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'get_user_by_email',
        description: 'Fetch a Croc Shop user record by email address.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string' },
          },
          required: ['email'],
        },
      },
      {
        name: 'get_order_by_id',
        description: 'Fetch a Croc Shop order by its numeric ID.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'integer', minimum: 1 },
          },
          required: ['orderId'],
        },
      },
      {
        name: 'get_product_by_id',
        description: 'Fetch a Croc Shop product by its numeric ID.',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'integer', minimum: 1 },
          },
          required: ['productId'],
        },
      },
      {
        name: 'get_low_stock_products',
        description: 'List products with stock at or below a threshold.',
        inputSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'integer', minimum: 0, maximum: 1000 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'get_user_orders',
        description: 'Fetch recent orders for a user by user ID or email address.',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'integer', minimum: 1 },
            email: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'get_recent_orders',
        description: 'Fetch recent orders, optionally filtered by order status.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            status: { type: 'string' },
          },
        },
      },
      {
        name: 'get_order_summary',
        description: 'Get aggregate order totals, recent order activity, and status breakdowns.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'get_schema_summary') {
        return formatText(await getSchemaSummary());
      }

      if (name === 'list_tables') {
        return formatText(await getTables());
      }

      if (name === 'describe_table') {
        const { table } = tableSchema.parse(args ?? {});
        return formatText(await describeTable(table));
      }

      if (name === 'run_readonly_query') {
        const { sql, limit } = queryToolSchema.parse(args ?? {});
        return formatText(await runReadOnlyQuery(sql, limit));
      }

      if (name === 'search_products') {
        return formatText(await searchProducts(searchProductsSchema.parse(args ?? {})));
      }

      if (name === 'get_user_by_email') {
        const { email } = userByEmailSchema.parse(args ?? {});
        return formatText(await getUserByEmail(email));
      }

      if (name === 'get_order_by_id') {
        const { orderId } = orderByIdSchema.parse(args ?? {});
        return formatText(await getOrderById(orderId));
      }

      if (name === 'get_product_by_id') {
        const { productId } = productByIdSchema.parse(args ?? {});
        return formatText(await getProductById(productId));
      }

      if (name === 'get_low_stock_products') {
        return formatText(await getLowStockProducts(lowStockProductsSchema.parse(args ?? {})));
      }

      if (name === 'get_user_orders') {
        return formatText(await getUserOrders(userOrdersSchema.parse(args ?? {})));
      }

      if (name === 'get_recent_orders') {
        return formatText(await getRecentOrders(recentOrdersSchema.parse(args ?? {})));
      }

      if (name === 'get_order_summary') {
        return formatText(await getOrderSummary());
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function isJsonRpcInitializeRequest(body) {
  return isInitializeRequest(body);
}

function withHttpMetrics(routeLabel, handler) {
  return async (req, res, next) => {
    const end = httpRequestDuration.startTimer();

    res.on('finish', () => {
      const statusCode = String(res.statusCode);
      httpRequestsTotal.inc({ method: req.method, route: routeLabel, status_code: statusCode });
      end({ method: req.method, route: routeLabel, status_code: statusCode });
    });

    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function startStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttpServer() {
  const app = express();
  const transports = new Map();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', withHttpMetrics('/health', async (req, res) => {
    res.json({ status: 'healthy', service: 'croc-shop-data-mcp' });
  }));

  app.get('/ready', withHttpMetrics('/ready', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready', service: 'croc-shop-data-mcp' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }));

  app.get('/metrics', withHttpMetrics('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  }));

  app.post('/mcp', withHttpMetrics('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (!isJsonRpcInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport);
        },
      });

      transport.onclose = () => {
        const activeSessionId = transport.sessionId;
        if (activeSessionId) {
          transports.delete(activeSessionId);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    await transport.handleRequest(req, res, req.body);
  }));

  app.get('/mcp', withHttpMetrics('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    await transports.get(sessionId).handleRequest(req, res);
  }));

  app.delete('/mcp', withHttpMetrics('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    await transports.get(sessionId).handleRequest(req, res);
  }));

  app.use((error, req, res, next) => {
    console.error('Unhandled Data MCP service error:', error);
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  });

  const server = app.listen(HTTP_PORT, () => {
    console.log(`croc-shop-data-mcp listening on port ${HTTP_PORT}`);
  });

  const shutdown = async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function normalizeSql(sql) {
  return sql.replace(/--.*$/gm, '').trim();
}

function assertReadOnlySql(sql) {
  const normalized = normalizeSql(sql);
  if (!normalized) {
    throw new Error('SQL must not be empty.');
  }

  if (normalized.includes(';')) {
    throw new Error('Only a single SQL statement is allowed.');
  }

  const upper = normalized.toUpperCase();
  if (!(upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('EXPLAIN'))) {
    throw new Error('Only read-only SELECT, WITH, and EXPLAIN statements are allowed.');
  }

  const forbidden = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'TRUNCATE',
    'CREATE',
    'GRANT',
    'REVOKE',
    'MERGE',
    'COPY',
    'DO',
    'CALL',
    'SET ',
    'SHOW ',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'VACUUM',
    'ANALYZE',
    'REFRESH',
  ];

  for (const keyword of forbidden) {
    if (upper.includes(keyword)) {
      throw new Error(`Forbidden SQL keyword detected: ${keyword.trim()}`);
    }
  }

  return normalized;
}

function getStatementKind(sql) {
  const upper = sql.toUpperCase();
  if (upper.startsWith('EXPLAIN')) {
    return 'EXPLAIN';
  }
  if (upper.startsWith('WITH')) {
    return 'WITH';
  }
  return 'SELECT';
}

async function getTables() {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name ASC`
  );

  return result.rows.map((row) => row.table_name);
}

async function describeTable(table) {
  const result = await pool.query(
    `SELECT
       column_name,
       data_type,
       is_nullable,
       column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [table]
  );

  if (result.rows.length === 0) {
    throw new Error(`Table not found: ${table}`);
  }

  return result.rows;
}

async function getOrderSummary() {
  const [statusBreakdown, totals, recentCount] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*)::int AS order_count, COALESCE(SUM(total)::float8, 0) AS total_amount
       FROM orders
       GROUP BY status
       ORDER BY status ASC`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_orders,
              COALESCE(SUM(total)::float8, 0) AS gross_revenue,
              COALESCE(AVG(total)::float8, 0) AS average_order_value
       FROM orders`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS orders_last_7_days
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    ),
  ]);

  return {
    totals: totals.rows[0],
    recentActivity: recentCount.rows[0],
    statusBreakdown: statusBreakdown.rows,
  };
}

async function getSchemaSummary() {
  const [tables, columns] = await Promise.all([
    pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name ASC`
    ),
    pool.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name ASC, ordinal_position ASC`
    ),
  ]);

  const byTable = new Map();
  for (const row of tables.rows) {
    byTable.set(row.table_name, []);
  }

  for (const row of columns.rows) {
    if (!byTable.has(row.table_name)) {
      byTable.set(row.table_name, []);
    }
    byTable.get(row.table_name).push({
      column: row.column_name,
      type: row.data_type,
    });
  }

  return Object.fromEntries(byTable.entries());
}

async function searchProducts({ category, search, limit }) {
  const params = [];
  const where = [];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  params.push(limit ?? 25);

  const result = await pool.query(
    `SELECT id, name, price::float8 AS price, description, stock, category, image
     FROM products
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY id ASC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

async function getProductById(productId) {
  const result = await pool.query(
    `SELECT id, name, price::float8 AS price, description, stock, category, image
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }

  return result.rows[0];
}

async function getLowStockProducts({ threshold, limit }) {
  const result = await pool.query(
    `SELECT id, name, price::float8 AS price, stock, category
     FROM products
     WHERE stock <= $1
     ORDER BY stock ASC, id ASC
     LIMIT $2`,
    [threshold ?? 10, limit ?? 25]
  );

  return result.rows;
}

async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, email, name, shipping_address, shipping_city, shipping_state, shipping_zip, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error(`User not found for email: ${email}`);
  }

  return result.rows[0];
}

async function getUserOrders({ userId, email, limit }) {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User not found for email: ${email}`);
    }

    resolvedUserId = userResult.rows[0].id;
  }

  const result = await pool.query(
    `SELECT id, user_id, total::float8 AS total, status, payment_method, paid_at, shipped_at, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [resolvedUserId, limit ?? 25]
  );

  return {
    userId: resolvedUserId,
    orders: result.rows,
  };
}

async function getOrderById(orderId) {
  const result = await pool.query(
    `SELECT id, user_id, items, total::float8 AS total, status,
            shipping_address, shipping_city, shipping_state, shipping_zip,
            payment_method, paid_at, shipped_at, created_at
     FROM orders
     WHERE id = $1`,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return result.rows[0];
}

async function getRecentOrders({ limit, status }) {
  const params = [];
  let whereClause = '';

  if (status) {
    params.push(status);
    whereClause = `WHERE status = $${params.length}`;
  }

  params.push(limit ?? 25);

  const result = await pool.query(
    `SELECT id, user_id, total::float8 AS total, status, payment_method, paid_at, shipped_at, created_at
     FROM orders
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

async function runReadOnlyQuery(sql, limit) {
  const normalized = assertReadOnlySql(sql);
  const effectiveLimit = limit ?? MAX_ROW_LIMIT;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    await client.query("SET LOCAL statement_timeout = '10000'");
    const statementKind = getStatementKind(normalized);
    const sqlToRun = statementKind === 'EXPLAIN'
      ? normalized
      : `SELECT * FROM (${normalized}) AS mcp_query LIMIT ${effectiveLimit}`;
    const result = await client.query(sqlToRun);
    await client.query('ROLLBACK');

    return {
      statementKind,
      rowCount: result.rowCount,
      rows: result.rows,
      limit: effectiveLimit,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
    }
    throw error;
  } finally {
    client.release();
  }
}

const startInHttpMode = process.argv.includes('--http') || (!process.argv.includes('--stdio') && process.env.MCP_TRANSPORT === 'http');

if (startInHttpMode) {
  await startHttpServer();
} else {
  await startStdioServer();

  const shutdown = async () => {
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
