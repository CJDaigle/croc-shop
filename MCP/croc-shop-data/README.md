# Croc Shop Data MCP Server

Read-only MCP server for querying the Croc Shop PostgreSQL database.

## Tools

- `get_schema_summary`
- `list_tables`
- `describe_table`
- `run_readonly_query`
- `search_products`
- `get_user_by_email`
- `get_order_by_id`
- `get_product_by_id`
- `get_low_stock_products`
- `get_user_orders`
- `get_recent_orders`
- `get_order_summary`

## Safety model

This server is intentionally limited to read-only SQL access.

Allowed query starts:
- `SELECT`
- `WITH`
- `EXPLAIN`

Blocked query types include:
- `INSERT`
- `UPDATE`
- `DELETE`
- `DROP`
- `ALTER`
- `TRUNCATE`
- `CREATE`
- transaction control and administrative statements

Queries run in a read-only transaction with a statement timeout.

## Local setup

1. Copy `.env.example` to `.env`
2. Set database connection values
3. Install dependencies
4. Start the MCP server

```bash
cp .env.example .env
npm install
npm start
```

You can also use the repo-level `.mcp.json` configuration to register this server with an MCP client.

## Environment variables

- `DATABASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `MCP_QUERY_ROW_LIMIT`

`DATABASE_URL` is optional if the individual `PG*` variables are set.

## Suggested repo role

This MCP server is intended for LLM-driven data inspection of the Croc Shop demo database, especially:
- products
- users
- orders

It is intentionally scoped to PostgreSQL and does not query Redis carts.
