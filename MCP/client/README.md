# Croc Shop MCP Client

Host application that connects Claude to one or more MCP servers.

This client is the orchestration layer between the Anthropic Messages API and the Croc Shop MCP servers. It discovers MCP tools, exposes a simple HTTP interface for your application tier, executes Claude-requested tool calls against the MCP server, and returns the final model response.

## Architecture

```text
Your app -> MCP client -> Anthropic API
                  |
                  -> MCP server
```

For the current Croc Shop setup, the default MCP target is the deployed HTTP MCP endpoint at `https://data-mcp.apo-llm-test.com/mcp`.

## What this service does

- connects to an MCP server over Streamable HTTP
- discovers available MCP tools
- converts MCP tool schemas into Anthropic tool definitions
- sends user messages plus tool definitions to Claude
- executes tool calls requested by Claude against the MCP server
- sends tool results back to Claude until a final answer is produced

## HTTP endpoints

- `GET /health`
- `GET /ready`
- `GET /tools`
- `POST /chat`

## Request flow

1. Your application sends chat history to `POST /chat`
2. The client ensures it can connect to the MCP server
3. The client lists available tools from the MCP server
4. The client calls Anthropic with the message history and tool definitions
5. If Claude returns `tool_use` blocks, the client executes those MCP tools
6. The client sends `tool_result` blocks back to Anthropic
7. The loop continues until Claude returns a final answer

## Environment variables

- `PORT`
- `MCP_SERVER_URL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_MAX_TOKENS`
- `SYSTEM_PROMPT`

Example `.env`:

```bash
cp .env.example .env
```

```env
PORT=3010
MCP_SERVER_URL=https://data-mcp.apo-llm-test.com/mcp
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_MAX_TOKENS=1024
SYSTEM_PROMPT=You are a helpful assistant for the Croc Shop demo. Use MCP tools when they help answer the user accurately.
```

## Local development

From `MCP/client`:

```bash
npm install
npm start
```

The service starts on `http://localhost:3010` by default.

## Health and readiness

### Health

`GET /health` confirms that the process is running.

Example response:

```json
{
  "status": "healthy",
  "service": "croc-shop-mcp-client"
}
```

### Readiness

`GET /ready` verifies that the client can connect to the configured MCP server and list tools.

Example response:

```json
{
  "status": "ready",
  "service": "croc-shop-mcp-client",
  "toolCount": 12
}
```

## List discovered tools

```bash
curl http://localhost:3010/tools
```

## Chat API

### Request format

`POST /chat`

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are the lowest-stock products right now?"
    }
  ]
}
```

Optional request fields:

- `system`
- `model`
- `maxTokens`

### Example request

```bash
curl -X POST http://localhost:3010/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Show me the three lowest stock products."
      }
    ]
  }'
```

### Example response shape

```json
{
  "model": "claude-sonnet-4-20250514",
  "stopReason": "end_turn",
  "text": "The three lowest-stock products are ...",
  "content": [],
  "toolResults": [
    {
      "id": "toolu_...",
      "name": "get_low_stock_products",
      "input": {
        "limit": 3
      },
      "isError": false,
      "result": "..."
    }
  ]
}
```

## Docker build

From the repo root:

```bash
docker build -t cjdaigle2/croc-shop-mcp-client:latest ./MCP/client
```

Run it locally:

```bash
docker run --rm -p 3010:3010 --env-file ./MCP/client/.env cjdaigle2/croc-shop-mcp-client:latest
```

If you are building from an Apple Silicon machine for AMD64 Kubernetes nodes, build with an explicit platform:

```bash
docker buildx build --platform linux/amd64 -t cjdaigle2/croc-shop-mcp-client:latest ./MCP/client --load
```

## Deployment guidance

This service is intended to run as the middle tier inside your AWS VPC or Kubernetes cluster.

Recommended placement:

- ECS/Fargate in the VPC
- EKS deployment in-cluster
- EC2 if you want a simpler first host

Recommended responsibilities for the surrounding app stack:

- authenticate end users before calling this client
- keep the Anthropic API key in Secrets Manager or Kubernetes secrets
- log tool usage and request IDs
- add rate limits and request validation at the edge

## Kubernetes service deployment

This repo now includes Kubernetes manifests to run the MCP client as part of the Croc Shop microservice architecture.

Deployment assets:

- `k8s/base/namespaces.yaml`
- `k8s/base/mcp-client-deployment.yaml`
- `k8s/base/network-policy.yaml`

The service runs in the `croc-shop-mcp-client` namespace and is exposed internally in-cluster as the `mcp-client` ClusterIP service on port `3010`.

### What gets created

- `Namespace` named `croc-shop-mcp-client`
- `ConfigMap` named `mcp-client-config`
- `Secret` named `mcp-client-secret`
- `Deployment` named `mcp-client`
- `Service` named `mcp-client`
- `NetworkPolicy` named `mcp-client-policy`

### Required secret configuration

Before deploying, populate the `ANTHROPIC_API_KEY` value in `k8s/base/mcp-client-deployment.yaml` or replace that secret management approach with your preferred secret workflow.

### Apply the service manifests

From the repo root:

```bash
kubectl apply -f k8s/base/namespaces.yaml
kubectl apply -f k8s/base/mcp-client-deployment.yaml
kubectl apply -f k8s/base/network-policy.yaml
```

### Verify the internal service

```bash
kubectl get pods -n croc-shop-mcp-client
kubectl get svc -n croc-shop-mcp-client mcp-client
kubectl describe deployment -n croc-shop-mcp-client mcp-client
```

## Public exposure through the shared Gateway

This repo also includes manifests to expose the MCP client publicly at `https://mcp-client.apo-llm-test.com` through the shared Cilium Gateway.

Gateway-related manifests:

- `k8s/cilium-gateway/certificates.yaml`
- `k8s/cilium-gateway/gateway.yaml`
- `k8s/cilium-gateway/mcp-client-httproute.yaml`

Apply them with:

```bash
kubectl apply -f k8s/cilium-gateway/certificates.yaml
kubectl apply -f k8s/cilium-gateway/gateway.yaml
kubectl apply -f k8s/cilium-gateway/mcp-client-httproute.yaml
```

### Public readiness checks

```bash
curl https://mcp-client.apo-llm-test.com/health
curl https://mcp-client.apo-llm-test.com/ready
```

The public route exposes the client service itself, so you should put authentication and rate limiting in front of it before using it as an internet-facing entrypoint.

## Security notes

- The MCP client has access to your Anthropic API key and to the MCP server
- Treat it as a privileged internal service
- Prefer private network access to the MCP server when possible
- Restrict who can call `POST /chat`
- Review and constrain the MCP tools you expose to Claude

## Current scope

This initial version is intentionally simple:

- one configured MCP server
- synchronous non-streaming Anthropic call flow
- one HTTP chat endpoint for orchestration

Future enhancements you may want:

- support multiple MCP servers
- streaming responses
- session persistence
- authn/authz for callers
- audit logging
- per-tool allowlists
- retry and circuit-breaker behavior
