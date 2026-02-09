# Crocs Shop - Cloud-Native E-Commerce Demo

A realistic cloud-native microservices application demonstrating Kubernetes and service mesh capabilities.

## Architecture

This application demonstrates a **multi-namespace service mesh architecture** where each microservice runs in its own Kubernetes namespace, showcasing advanced service mesh capabilities:

### Microservices (Each in Dedicated Namespace)
- **Frontend Service** (`crock-shop-frontend`): React-based web UI
- **Product Catalog Service** (`crock-shop-product-catalog`): Manages product inventory (Node.js)
- **Shopping Cart Service** (`crock-shop-cart`): Handles user shopping carts (Python/Flask)
- **Order Service** (`crock-shop-order`): Processes orders (Go)
- **User Service** (`crock-shop-user`): User authentication and profiles (Node.js)

### Data Layer (`crock-shop-data`)
- **PostgreSQL**: Database for persistent storage
- **Redis**: Cache layer for sessions and cart data

### Observability (`crock-shop-monitoring`)
- **Prometheus**: Metrics collection across all namespaces
- **Grafana**: Visualization and dashboards

## Technology Stack

- **Frontend**: React, TailwindCSS
- **Backend Services**: Node.js, Python/Flask, Go
- **Databases**: PostgreSQL, Redis
- **Container Runtime**: Docker
- **Orchestration**: Kubernetes
- **Service Mesh**: Istio
- **Observability**: Prometheus, Grafana, Jaeger

## Kubernetes Features Demonstrated

### Core Kubernetes
- **Multi-Namespace Architecture**: Each service in dedicated namespace
- **Deployments and ReplicaSets**: High availability with 2+ replicas
- **Services**: ClusterIP with cross-namespace FQDN resolution
- **ConfigMaps and Secrets**: Environment-specific configuration
- **Persistent Volumes and Claims**: Stateful data storage
- **Horizontal Pod Autoscaling**: CPU/memory-based scaling
- **Network Policies**: Cross-namespace communication control

### Service Mesh (Istio)
- **Cross-Namespace Service Discovery**: ServiceEntries for mesh-wide communication
- **mTLS Encryption**: Automatic mutual TLS between namespaces
- **Traffic Management**: DestinationRules with load balancing strategies
- **Circuit Breaking**: Fault tolerance and resilience
- **Retry Policies**: Automatic retry on failures
- **Authorization Policies**: Namespace-level access control
- **Gateway & VirtualService**: Unified ingress routing

### Observability
- **Prometheus**: Multi-namespace metrics collection
- **Grafana**: Cross-namespace dashboards
- **Jaeger**: Distributed tracing across namespaces
- **Kiali**: Service mesh topology visualization

## Project Structure

```
crock-shop/
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
│   │   └── network-policy.yaml # Cross-namespace policies
│   ├── istio/
│   │   ├── gateway.yaml       # Istio ingress gateway
│   │   ├── service-entries.yaml # Cross-namespace discovery
│   │   ├── destination-rules.yaml # Traffic policies
│   │   ├── authorization-policies.yaml # Access control
│   │   └── retry-policy.yaml  # Resilience patterns
│   └── monitoring/
│       ├── prometheus.yaml    # Multi-namespace scraping
│       └── grafana.yaml       # Observability dashboards
├── scripts/                    # Deployment automation
└── docker-compose.yml         # Local development
```

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.
