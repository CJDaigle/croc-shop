# MCP Servers

This directory contains Model Context Protocol servers for the Croc Shop demo.

Some MCP servers in this repo can run in two modes:
- local `stdio` mode for IDE or desktop MCP clients
- deployable HTTP service mode for in-cluster use

## Servers

- `croc-shop-data/` — Read-only PostgreSQL data access for LLM-driven querying

## Deploying an MCP server as a service

For deployable MCP servers, the source lives under `MCP/`, while the deployment assets live in the main repo infrastructure directories.

For `croc-shop-data`:
- container build file: `MCP/croc-shop-data/Dockerfile`
- Kubernetes manifest: `k8s/base/data-mcp-deployment.yaml`
- network access policy: `k8s/base/network-policy.yaml`

Typical flow:

1. Build the image from the MCP server directory.
2. Push the image to your container registry.
3. Update the image reference in `k8s/base/data-mcp-deployment.yaml` if needed.
4. Apply the deployment manifest.
5. Apply the shared network policy manifest if your cluster does not already have the `data-mcp` policy.

Example commands from the repo root:

```bash
docker build -t cjdaigle2/croc-shop-data-mcp:latest ./MCP/croc-shop-data
docker push cjdaigle2/croc-shop-data-mcp:latest
kubectl apply -f k8s/base/data-mcp-deployment.yaml
kubectl apply -f k8s/base/network-policy.yaml
```

After deployment, the service is exposed internally in Kubernetes as `data-mcp` in the `croc-shop-data` namespace and serves HTTP endpoints on port `3006`, including the MCP endpoint at `/mcp`.

It can also be exposed externally through the shared Cilium Gateway at `https://data-mcp.apo-llm-test.com` using the manifests under `k8s/cilium-gateway/`.

Additional MCP servers can be added here later, for example:
- operations and observability tools
- admin and deployment tools
- domain-specific application workflows
