# Crocs Shop - Cloud-Native E-Commerce Demo

A realistic cloud-native microservices application demonstrating Kubernetes and Cilium service mesh capabilities, running on RKE2 (AWS EC2, Rancher managed) with Cilium Gateway API.

## Architecture

This application demonstrates a **multi-namespace service mesh architecture** where each microservice runs in its own Kubernetes namespace on a 10-node RKE2 cluster with Cilium v1.18.6 as the CNI and service mesh:

### Microservices (Each in Dedicated Namespace)
- **Frontend Service** (`croc-shop-frontend`): React-based web UI
- **Product Catalog Service** (`croc-shop-product-catalog`): Postgres-backed product catalog (Node.js)
- **Shopping Cart Service** (`croc-shop-cart`): Handles user shopping carts (Python/Flask)
- **Order Service** (`croc-shop-order`): Processes orders (Go)
- **User Service** (`croc-shop-user`): User authentication and profiles (Node.js)

### Data Layer (`croc-shop-data`)
- **PostgreSQL**: Database for persistent storage
- **Redis**: Cache layer for sessions and cart data

### Observability (`croc-shop-monitoring`)
- **Prometheus**: Metrics collection across all namespaces
- **Grafana**: Visualization and dashboards

## Technology Stack

- **Platform**: RKE2 on AWS EC2 (Rancher managed)
- **Frontend**: React, TailwindCSS
- **Backend Services**: Node.js, Python/Flask, Go
- **Databases**: PostgreSQL, Redis
- **Container Runtime**: Docker
- **Orchestration**: Kubernetes v1.31.12+rke2r1
- **CNI + Service Mesh**: Cilium v1.18.6 (Helm)
- **Ingress**: Cilium Gateway API (dedicated gateway nodes, hostNetwork)
- **TLS**: cert-manager + Let's Encrypt
- **Storage**: Longhorn
- **Observability**: Prometheus, Grafana, Hubble
- **Domain**: `apo-llm-test.com` (Route 53)

## Kubernetes Features Demonstrated

### Core Kubernetes
- **Multi-Namespace Architecture**: Each service in dedicated namespace
- **Deployments and ReplicaSets**: High availability with 2+ replicas
- **Services**: ClusterIP with cross-namespace FQDN resolution
- **ConfigMaps and Secrets**: Environment-specific configuration
- **Persistent Volumes and Claims**: Stateful data storage
- **Horizontal Pod Autoscaling**: CPU/memory-based scaling
- **Network Policies**: Cross-namespace communication control

### Service Mesh (Cilium)
- **eBPF-Based Networking**: High-performance CNI with VXLAN tunnel mode
- **Gateway API**: Cilium GatewayClass with HTTPRoute-based path routing
- **Dedicated Gateway Nodes**: 2 nodes labeled `role=gateway` with hostNetwork Envoy
- **Network Policies**: Standard K8s NetworkPolicy enforced by Cilium at eBPF level
- **ClusterMesh**: Enabled for multi-cluster connectivity
- **Hubble Metrics**: dns, drop, tcp, flow, icmp, http

### Observability
- **Prometheus**: Multi-namespace metrics collection
- **Grafana**: Cross-namespace dashboards
- **Hubble**: Real-time network flow visibility and service dependency mapping

## Project Structure

```
croc-shop/
├── services/                    # Microservices source code
│   ├── frontend/               # React UI
│   ├── product-catalog/        # Node.js service
│   ├── cart/                   # Python/Flask service
│   ├── order/                  # Go service
│   └── user/                   # Node.js auth service
├── k8s/
│   ├── base/
│   │   ├── namespaces.yaml    # 7 dedicated namespaces
│   │   ├── *-deployment.yaml  # Per-namespace deployments
│   │   └── network-policy.yaml # Cross-namespace policies (Cilium-enforced)
│   ├── gateway/
│   │   ├── gateway.yaml       # Cilium Gateway API (HTTP/HTTPS listeners)
│   │   ├── httproute.yaml     # Path-based routing to backend services
│   │   └── reference-grants.yaml # Cross-namespace backend access
│   ├── istio/                 # Legacy Istio configs (kept for reference)
│   └── monitoring/
│       ├── prometheus.yaml    # Multi-namespace scraping
│       └── grafana.yaml       # Observability dashboards
├── docs/
│   └── infrastructure/        # Cluster provisioning & Cilium setup
│       ├── configure-cilium-in-aws.md
│       ├── cilium-gateway-recap.md
│       ├── cilium-overrides.yaml
│       ├── cilium-values.yaml
│       └── cluster.RKE2.yaml
├── scripts/                    # Deployment automation
└── docker-compose.yml         # Local development
```

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.
