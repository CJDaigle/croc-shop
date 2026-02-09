# Multi-Namespace Service Mesh Architecture Guide

This document explains the multi-namespace architecture of Crocs Shop and how it demonstrates advanced Kubernetes and service mesh capabilities.

## Architecture Overview

Crocs Shop uses a **dedicated namespace per service** approach, which is a best practice for:
- **Isolation**: Each service has its own security boundary
- **Resource Management**: Namespace-level quotas and limits
- **Access Control**: Fine-grained RBAC and network policies
- **Service Mesh**: Demonstrates cross-namespace mTLS and traffic management

## Namespace Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     istio-system                            │
│              (Istio Control Plane)                          │
│         Gateway + VirtualService                            │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│ croc-shop-    │ │ croc-shop- │ │ croc-shop-    │
│   frontend     │ │   product-  │ │     user       │
│                │ │   catalog   │ │                │
└────────┬───────┘ └──────┬──────┘ └───────┬────────┘
         │                │                 │
         │         ┌──────▼──────┐          │
         │         │ croc-shop- │          │
         └────────▶│    data     │◀─────────┘
                   │ (Postgres + │
                   │   Redis)    │
                   └─────────────┘

┌───────────────┐  ┌────────────────┐
│ croc-shop-   │  │ croc-shop-    │
│    cart       │  │    order       │
└───────┬───────┘  └────────────────┘
        │
        └──────────▶ croc-shop-data

┌─────────────────────────────────────┐
│    croc-shop-monitoring            │
│  (Prometheus scrapes all namespaces)│
└─────────────────────────────────────┘
```

## Namespace Breakdown

### 1. `croc-shop-frontend`
**Purpose**: User-facing web application  
**Resources**: Frontend deployment, service  
**Communication**: Calls all backend services via FQDN  
**Istio Features**: Gateway entry point, client-side load balancing

### 2. `croc-shop-product-catalog`
**Purpose**: Product inventory management  
**Resources**: Product catalog deployment, service, HPA, ConfigMap  
**Communication**: 
- Receives requests from frontend
- Connects to PostgreSQL in `croc-shop-data`
**Istio Features**: 
- LEAST_REQUEST load balancing
- Circuit breaker configuration
- Retry policies

### 3. `croc-shop-user`
**Purpose**: Authentication and user management  
**Resources**: User deployment, service, HPA, Secret (JWT)  
**Communication**: Receives requests from frontend  
**Istio Features**: ROUND_ROBIN load balancing

### 4. `croc-shop-cart`
**Purpose**: Shopping cart management  
**Resources**: Cart deployment, service, HPA, ConfigMap  
**Communication**:
- Receives requests from frontend
- Connects to Redis in `croc-shop-data`
**Istio Features**: Consistent hash load balancing by user-id

### 5. `croc-shop-order`
**Purpose**: Order processing  
**Resources**: Order deployment, service, HPA  
**Communication**: Receives requests from frontend  
**Istio Features**: 
- LEAST_REQUEST load balancing
- Retry policies

### 6. `croc-shop-data`
**Purpose**: Data layer isolation  
**Resources**: PostgreSQL, Redis deployments and services  
**Communication**: Only accepts connections from authorized namespaces  
**Security**: 
- Network policies restrict access
- Authorization policies enforce namespace-level ACLs

### 7. `croc-shop-monitoring`
**Purpose**: Observability stack  
**Resources**: Prometheus, Grafana  
**Communication**: Scrapes metrics from all croc-shop namespaces  
**Features**: Cross-namespace service discovery for monitoring

## Cross-Namespace Communication

### Service Discovery
Services communicate across namespaces using **Fully Qualified Domain Names (FQDN)**:

```
<service>.<namespace>.svc.cluster.local
```

Examples:
- Frontend → Product Catalog: `product-catalog.croc-shop-product-catalog.svc.cluster.local:3001`
- Cart → Redis: `redis.croc-shop-data.svc.cluster.local:6379`
- Product Catalog → PostgreSQL: `postgres.croc-shop-data.svc.cluster.local:5432`

### Istio ServiceEntries
ServiceEntries explicitly define cross-namespace service dependencies:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: product-catalog-entry
  namespace: croc-shop-frontend
spec:
  hosts:
  - product-catalog.croc-shop-product-catalog.svc.cluster.local
  location: MESH_INTERNAL
  resolution: DNS
```

This enables:
- Service mesh visibility across namespaces
- mTLS encryption between namespaces
- Traffic metrics and tracing

### Network Policies
Kubernetes NetworkPolicies control which namespaces can communicate:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: product-catalog-policy
  namespace: croc-shop-product-catalog
spec:
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: croc-shop-frontend
```

### Authorization Policies
Istio AuthorizationPolicies add service mesh-level access control:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: frontend-to-services
  namespace: croc-shop-product-catalog
spec:
  action: ALLOW
  rules:
  - from:
    - source:
        namespaces: ["croc-shop-frontend", "istio-system"]
```

## Service Mesh Features Demonstrated

### 1. Mutual TLS (mTLS)
All cross-namespace communication is automatically encrypted with mTLS when Istio injection is enabled.

**Verify mTLS**:
```bash
istioctl authn tls-check <pod-name>.<namespace>
```

### 2. Traffic Management

**Load Balancing Strategies**:
- Product Catalog: LEAST_REQUEST (best for variable request times)
- User Service: ROUND_ROBIN (simple distribution)
- Cart Service: Consistent Hash by user-id (session affinity)
- Order Service: LEAST_REQUEST (optimal for processing)

### 3. Resilience Patterns

**Circuit Breaking**:
```yaml
outlierDetection:
  consecutiveGatewayErrors: 5
  interval: 30s
  baseEjectionTime: 30s
```

**Retry Policies**:
```yaml
retries:
  attempts: 3
  perTryTimeout: 2s
  retryOn: 5xx,reset,connect-failure
```

### 4. Observability

**Distributed Tracing**:
- Traces span across all namespaces
- View in Jaeger: `istioctl dashboard jaeger`

**Service Graph**:
- Visualize cross-namespace communication
- View in Kiali: `istioctl dashboard kiali`

**Metrics**:
- Prometheus scrapes all namespaces
- Grafana dashboards show cross-namespace traffic

## Deployment Workflow

### 1. Create Namespaces
```bash
kubectl apply -f k8s/base/namespaces.yaml
```

All namespaces are labeled with `istio-injection: enabled` for automatic sidecar injection.

### 2. Deploy Services
```bash
# Data layer first
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/redis-deployment.yaml

# Then microservices
kubectl apply -f k8s/base/product-catalog-deployment.yaml
kubectl apply -f k8s/base/user-deployment.yaml
kubectl apply -f k8s/base/cart-deployment.yaml
kubectl apply -f k8s/base/order-deployment.yaml
kubectl apply -f k8s/base/frontend-deployment.yaml
```

### 3. Configure Service Mesh
```bash
# Gateway and routing
kubectl apply -f k8s/istio/gateway.yaml

# Cross-namespace discovery
kubectl apply -f k8s/istio/service-entries.yaml

# Traffic policies
kubectl apply -f k8s/istio/destination-rules.yaml
kubectl apply -f k8s/istio/retry-policy.yaml
kubectl apply -f k8s/istio/circuit-breaker.yaml

# Security policies
kubectl apply -f k8s/istio/authorization-policies.yaml
```

### 4. Deploy Monitoring
```bash
kubectl apply -f k8s/monitoring/prometheus.yaml
kubectl apply -f k8s/monitoring/grafana.yaml
```

## Verification Commands

### Check Namespace Status
```bash
kubectl get namespaces -l app=croc-shop
```

### View All Pods Across Namespaces
```bash
kubectl get pods --all-namespaces -l app=croc-shop
```

### Check Istio Sidecar Injection
```bash
kubectl get pods -n croc-shop-frontend -o jsonpath='{.items[*].spec.containers[*].name}'
# Should show: frontend istio-proxy
```

### View ServiceEntries
```bash
kubectl get serviceentries --all-namespaces
```

### Check Authorization Policies
```bash
kubectl get authorizationpolicies --all-namespaces
```

### View Network Policies
```bash
kubectl get networkpolicies --all-namespaces
```

### Test Cross-Namespace Communication
```bash
# Exec into frontend pod
kubectl exec -it -n croc-shop-frontend <pod-name> -c frontend -- sh

# Test connection to product catalog
curl http://product-catalog.croc-shop-product-catalog.svc.cluster.local:3001/api/products
```

## Benefits of Multi-Namespace Architecture

### 1. **Security**
- Namespace-level RBAC
- Network isolation by default
- Explicit cross-namespace policies
- mTLS between all services

### 2. **Resource Management**
- Per-namespace resource quotas
- Independent scaling policies
- Isolated resource limits

### 3. **Team Autonomy**
- Different teams can own different namespaces
- Independent deployment cycles
- Namespace-level access control

### 4. **Service Mesh Capabilities**
- Demonstrates advanced Istio features
- Cross-namespace traffic management
- Namespace-aware observability
- Fine-grained authorization

### 5. **Production Readiness**
- Mirrors real-world enterprise architectures
- Supports multi-tenancy patterns
- Enables gradual rollouts per namespace
- Facilitates disaster recovery

## Troubleshooting

### Service Can't Reach Another Namespace

1. **Check NetworkPolicy**:
```bash
kubectl describe networkpolicy -n <namespace>
```

2. **Check AuthorizationPolicy**:
```bash
kubectl get authorizationpolicy -n <target-namespace>
```

3. **Verify ServiceEntry**:
```bash
kubectl get serviceentry -n <source-namespace>
```

4. **Check mTLS**:
```bash
istioctl authn tls-check <pod>.<namespace> <service>.<target-namespace>.svc.cluster.local
```

### Istio Sidecar Not Injected

1. **Check namespace label**:
```bash
kubectl get namespace <namespace> --show-labels
```

2. **Restart pods** after labeling namespace:
```bash
kubectl rollout restart deployment -n <namespace>
```

### Metrics Not Appearing in Prometheus

1. **Check pod annotations**:
```bash
kubectl get pod -n <namespace> -o yaml | grep prometheus.io
```

2. **Verify Prometheus scrape config**:
```bash
kubectl get configmap prometheus-config -n croc-shop-monitoring -o yaml
```

## Best Practices

1. **Always use FQDN** for cross-namespace service calls
2. **Define ServiceEntries** for all cross-namespace dependencies
3. **Implement NetworkPolicies** to restrict traffic
4. **Use AuthorizationPolicies** for service mesh-level security
5. **Monitor cross-namespace traffic** in Kiali
6. **Set resource quotas** per namespace
7. **Use consistent labeling** across namespaces
8. **Document service dependencies** between namespaces

## Conclusion

This multi-namespace architecture demonstrates enterprise-grade Kubernetes and service mesh patterns. It showcases:
- Advanced Istio capabilities
- Cross-namespace security and communication
- Production-ready observability
- Scalable microservices architecture

Perfect for learning and demonstrating cloud-native best practices!
