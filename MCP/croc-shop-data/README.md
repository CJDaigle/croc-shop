# Croc Shop Data MCP Server

Read-only MCP server for querying the Croc Shop PostgreSQL database.

This server supports two runtime modes:
- local `stdio` MCP mode for desktop and IDE clients
- deployable HTTP service mode for the in-cluster demo

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
npm run start:stdio
```

You can also use the repo-level `.mcp.json` configuration to register this server with an MCP client.

To run the deployable HTTP service locally:

```bash
npm run start:http
```

HTTP service endpoints:
- `/health`
- `/ready`
- `/metrics`
- `/mcp`

## Environment variables

- `DATABASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PORT`
- `MCP_TRANSPORT`
- `MCP_QUERY_ROW_LIMIT`

`DATABASE_URL` is optional if the individual `PG*` variables are set.

## Suggested repo role

This MCP server is intended for LLM-driven data inspection of the Croc Shop demo database, especially:
- products
- users
- orders

It is intentionally scoped to PostgreSQL and does not query Redis carts.

## Deployment assets

- `Dockerfile`
- `k8s/base/data-mcp-deployment.yaml`

The Kubernetes deployment runs this server in HTTP mode inside the `croc-shop-data` namespace.

## Deploy as a Kubernetes service

From the repo root:

```bash
docker build -t cjdaigle2/croc-shop-data-mcp:latest ./MCP/croc-shop-data
docker push cjdaigle2/croc-shop-data-mcp:latest
kubectl apply -f k8s/base/data-mcp-deployment.yaml
kubectl apply -f k8s/base/network-policy.yaml
```

If you publish a different tag or registry path, update the image in `k8s/base/data-mcp-deployment.yaml` before applying it.

### What gets created

- `ConfigMap` named `data-mcp-config`
- `Secret` named `data-mcp-secret`
- `Deployment` named `data-mcp`
- `Service` named `data-mcp`

All resources are created in the `croc-shop-data` namespace.

### Service behavior

- transport mode: HTTP MCP
- service port: `3006`
- liveness endpoint: `/health`
- readiness endpoint: `/ready`
- metrics endpoint: `/metrics`
- MCP endpoint: `/mcp`

### Verify the deployment

```bash
kubectl get pods -n croc-shop-data
kubectl get svc -n croc-shop-data data-mcp
kubectl describe deployment -n croc-shop-data data-mcp
```
