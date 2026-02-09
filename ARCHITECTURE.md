# Crocs Shop Architecture

## Overview

Crocs Shop is a cloud-native microservices application designed to demonstrate Kubernetes and service mesh capabilities. The application implements a simple e-commerce platform for selling footwear.

## Architecture Diagram

```
                                    ┌─────────────────┐
                                    │  Istio Gateway  │
                                    │   (Ingress)     │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
            ┌───────▼────────┐      ┌───────▼────────┐      ┌───────▼────────┐
            │    Frontend    │      │  Product       │      │     User       │
            │   (React)      │─────▶│  Catalog       │      │   Service      │
            │                │      │  (Node.js)     │      │  (Node.js)     │
            └────────┬───────┘      └───────┬────────┘      └───────┬────────┘
                     │                      │                        │
                     │                      │                        │
            ┌────────▼───────┐      ┌───────▼────────┐              │
            │     Cart       │      │   PostgreSQL   │              │
            │   Service      │      │   (Database)   │              │
            │  (Python)      │      └────────────────┘              │
            └────────┬───────┘                                      │
                     │                                               │
            ┌────────▼───────┐                                      │
            │     Redis      │                                      │
            │    (Cache)     │                                      │
            └────────────────┘                                      │
                     │                                               │
            ┌────────▼────────────────────────────────────────────┐ │
            │              Order Service (Go)                      │◀┘
            └──────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────┐
                    │   Observability Stack           │
                    ├─────────────────────────────────┤
                    │  Prometheus  │  Grafana  │      │
                    │  Jaeger      │  Kiali    │      │
                    └─────────────────────────────────┘
```

## Microservices

### Frontend Service
- **Technology**: React, TailwindCSS, Nginx
- **Port**: 80
- **Purpose**: User interface for browsing products, managing cart, and placing orders
- **Features**:
  - Product browsing and search
  - User authentication
  - Shopping cart management
  - Order history

### Product Catalog Service
- **Technology**: Node.js, Express
- **Port**: 3001
- **Database**: PostgreSQL
- **Purpose**: Manages product inventory and catalog
- **Endpoints**:
  - `GET /api/products` - List all products
  - `GET /api/products/:id` - Get product details
  - `POST /api/products` - Create new product
- **Features**:
  - Postgres-backed product catalog with automatic schema initialization
  - Automatic catalog seeding on startup (at least 25 products)
  - Category filtering
  - Stock management
  - Prometheus metrics

### User Service
- **Technology**: Node.js, Express
- **Port**: 3002
- **Purpose**: User authentication and profile management
- **Endpoints**:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/users/me` - Get current user profile
- **Features**:
  - JWT-based authentication
  - Password hashing with bcrypt
  - User profile management
  - Prometheus metrics

### Cart Service
- **Technology**: Python, Flask
- **Port**: 3003
- **Cache**: Redis
- **Purpose**: Shopping cart management
- **Endpoints**:
  - `GET /api/cart/:userId` - Get user's cart
  - `POST /api/cart/:userId/items` - Add item to cart
  - `DELETE /api/cart/:userId/items/:productId` - Remove item
  - `DELETE /api/cart/:userId` - Clear cart
- **Features**:
  - Session-based cart storage in Redis
  - Cart expiration (24 hours)
  - Real-time cart updates
  - Prometheus metrics

### Order Service
- **Technology**: Go
- **Port**: 3004
- **Purpose**: Order processing and management
- **Endpoints**:
  - `GET /api/orders` - List orders
  - `POST /api/orders` - Create new order
  - `GET /api/orders/:id` - Get order details
  - `PATCH /api/orders/:id/status` - Update order status
- **Features**:
  - Order creation and tracking
  - Order status management
  - User order history
  - Prometheus metrics

## Data Stores

### PostgreSQL
- **Purpose**: Primary relational database
- **Used By**: Product Catalog Service
- **Features**:
  - Persistent volume for data
  - Health checks
  - Connection pooling

### Redis
- **Purpose**: In-memory cache and session store
- **Used By**: Cart Service
- **Features**:
  - Fast cart data access
  - TTL-based expiration
  - High availability ready

## Kubernetes Resources

### Deployments
- All services use Kubernetes Deployments
- Minimum 2 replicas for high availability
- Rolling update strategy
- Resource requests and limits defined

### Services
- ClusterIP services for internal communication
- Service discovery via DNS
- Load balancing across pods

### ConfigMaps
- Environment-specific configuration
- Service endpoints
- Database connection strings

### Secrets
- Database passwords
- JWT secrets
- API keys

### HorizontalPodAutoscaler
- CPU-based autoscaling (70% threshold)
- Memory-based autoscaling (80% threshold)
- Min replicas: 2, Max replicas: 10

### PersistentVolumeClaims
- PostgreSQL data persistence
- 5Gi storage allocation

### NetworkPolicies
- Restrict pod-to-pod communication
- Allow only necessary traffic
- Database access control

## Istio Service Mesh

### Gateway
- External traffic entry point
- HTTP/HTTPS routing
- TLS termination ready

### VirtualServices
- Request routing rules
- Path-based routing
- Traffic splitting (A/B testing ready)

### DestinationRules
- Load balancing strategies:
  - Product Catalog: LEAST_REQUEST
  - User: ROUND_ROBIN
  - Cart: Consistent hashing by user-id
  - Order: LEAST_REQUEST
- Circuit breaking configuration
- Connection pool settings

### Retry Policies
- Automatic retry on failures
- 3 retry attempts
- 2s per-try timeout
- Retry on: 5xx, reset, connect-failure

### Circuit Breaker
- Consecutive errors threshold: 5
- Base ejection time: 30s
- Max ejection percentage: 50%
- Min health percentage: 40%

### Rate Limiting
- 100 requests per minute per pod
- Token bucket algorithm
- Configurable via EnvoyFilter

## Observability

### Metrics (Prometheus)
- All services expose `/metrics` endpoint
- Custom business metrics
- HTTP request duration histograms
- Request count by status code
- Resource utilization metrics

### Dashboards (Grafana)
- Pre-configured Prometheus datasource
- Service-level dashboards
- Infrastructure monitoring
- Custom alerting rules ready

### Distributed Tracing (Jaeger via Istio)
- End-to-end request tracing
- Service dependency mapping
- Latency analysis
- Error tracking

### Service Mesh Visualization (Kiali)
- Service topology
- Traffic flow visualization
- Configuration validation
- Health monitoring

## Security

### Network Policies
- Ingress/egress rules per service
- Database access restricted to authorized services
- DNS resolution allowed for all

### Secrets Management
- Kubernetes Secrets for sensitive data
- Base64 encoding
- RBAC for secret access

### Authentication
- JWT-based user authentication
- Token expiration (24 hours)
- Secure password hashing (bcrypt)

### Service-to-Service Communication
- mTLS via Istio (when enabled)
- Service account-based authentication
- Authorization policies ready

## Scalability

### Horizontal Scaling
- HPA for automatic scaling
- Manual scaling via kubectl
- Load balancing across replicas

### Vertical Scaling
- Resource requests/limits tunable
- Pod resource monitoring

### Database Scaling
- PostgreSQL: StatefulSet ready for replication
- Redis: Sentinel/Cluster mode ready

## High Availability

### Application Layer
- Multiple replicas per service
- Pod anti-affinity ready
- Health checks (liveness/readiness)

### Data Layer
- Persistent volumes with backup
- Database replication ready
- Redis persistence options

### Infrastructure
- Multi-zone deployment ready
- Load balancer integration
- Automatic failover

## Development Workflow

1. **Local Development**: Docker Compose
2. **Build**: Docker multi-stage builds
3. **Test**: Unit and integration tests (framework ready)
4. **Deploy**: Kubernetes manifests
5. **Monitor**: Prometheus + Grafana
6. **Debug**: Logs, metrics, traces

## Technology Choices Rationale

- **Node.js**: Fast, event-driven, good for I/O-bound services
- **Python/Flask**: Simple, readable, excellent for data processing
- **Go**: High performance, low resource usage, great for order processing
- **React**: Modern UI framework, component-based
- **PostgreSQL**: ACID compliance, relational data
- **Redis**: Fast in-memory storage, perfect for caching
- **Istio**: Advanced traffic management, observability
- **Prometheus**: Industry-standard metrics collection
- **Grafana**: Powerful visualization and alerting
