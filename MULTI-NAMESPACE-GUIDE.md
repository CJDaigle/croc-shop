# Multi-Namespace Service Mesh Architecture Guide

This document explains the multi-namespace architecture of Crocs Shop and how it demonstrates advanced Kubernetes and Cilium service mesh capabilities.

## Architecture Overview

Crocs Shop uses a **dedicated namespace per service** approach, which is a best practice for:
- **Isolation**: Each service has its own security boundary
- **Resource Management**: Namespace-level quotas and limits
- **Access Control**: Fine-grained RBAC and network policies
- **Service Mesh**: Demonstrates cross-namespace traffic management via Cilium Gateway API

## Namespace Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Gateway Nodes (role=gateway, hostNetwork)                  │
│  Cilium Gateway API (Envoy) → HTTPRoute path matching       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     kube-system                             │
│              (Cilium CNI + Service Mesh)                    │
│         Cilium Agent + Hubble + ClusterMesh                 │
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
         │         │ croc-shop- │           │
         └────────▶│    data     │◀─────────┘
                   │ (Postgres + │
                   │   Redis)    │
                   └─────────────┘

┌───────────────┐  ┌────────────────┐
│ croc-shop-    │  │ croc-shop-     │
│    cart       │  │    order       │
└───────┬───────┘  └────────────────┘
        │
        └──────────▶ croc-shop-data

┌─────────────────────────────────────┐
│    croc-shop-monitoring             │
│  (Prometheus scrapes all namespaces)│
└─────────────────────────────────────┘
```

## Namespace Breakdown

### 1. `croc-shop-frontend`
**Purpose**: User-facing web application  
**Resources**: Frontend deployment, service  
**Communication**: Calls all backend services via FQDN  
**Cilium Features**: Ingress entry point, eBPF-based load balancing

### 2. `croc-shop-product-catalog`
**Purpose**: Product inventory management  
**Resources**: Product catalog deployment, service, HPA, ConfigMap  
**Communication**: 
- Receives requests from frontend
- Connects to PostgreSQL in `croc-shop-data`
**Cilium Features**: 
- eBPF-based load balancing
- Network policy enforcement
- Hubble flow visibility

### 3. `croc-shop-user`
**Purpose**: Authentication and user management  
**Resources**: User deployment, service, HPA, Secret (JWT)  
**Communication**: Receives requests from frontend  
**Cilium Features**: eBPF-based load balancing

### 4. `croc-shop-cart`
**Purpose**: Shopping cart management  
**Resources**: Cart deployment, service, HPA, ConfigMap  
**Communication**:
- Receives requests from frontend
- Connects to Redis in `croc-shop-data`
**Cilium Features**: eBPF-based load balancing, identity-aware policy enforcement

### 5. `croc-shop-order`
**Purpose**: Order processing  
**Resources**: Order deployment, service, HPA  
**Communication**: Receives requests from frontend  
**Cilium Features**: 
- eBPF-based load balancing
- Network policy enforcement

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

### Cilium Cross-Namespace Communication
Cilium uses standard Kubernetes DNS for cross-namespace service discovery. No additional ServiceEntry resources are needed — Cilium's eBPF datapath handles routing natively.

Cilium provides:
- Automatic cross-namespace service resolution via DNS
- Transparent encryption between namespaces (WireGuard)
- Full traffic visibility via Hubble

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

### Cilium Network Policies
CiliumNetworkPolicy CRDs can be used for L7-aware access control beyond standard NetworkPolicies:

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: frontend-to-product-catalog
  namespace: croc-shop-product-catalog
spec:
  endpointSelector:
    matchLabels:
      app: product-catalog
  ingress:
  - fromEndpoints:
    - matchLabels:
        k8s:io.kubernetes.pod.namespace: croc-shop-frontend
    toPorts:
    - ports:
      - port: "3001"
        protocol: TCP
```

## Service Mesh Features Demonstrated

### 1. Transparent Encryption
All cross-namespace communication can be encrypted using Cilium's WireGuard integration.

**Verify encryption**:
```bash
cilium encrypt status
```

### 2. Gateway API Routing
External traffic enters via dedicated gateway nodes running Cilium's Envoy-based Gateway API. HTTPRoutes provide path-based routing to backend services across namespaces, with ReferenceGrants controlling cross-namespace access.

```bash
kubectl get gateway croc-shop-gateway
kubectl get httproutes
kubectl get referencegrants --all-namespaces
```

### 3. Load Balancing
Cilium provides eBPF-based load balancing with `nodePort.enabled: true` (required for Gateway API in Cilium 1.18).

### 4. Network Policy Enforcement
Cilium enforces standard Kubernetes NetworkPolicies at the eBPF level and supports extended CiliumNetworkPolicy CRDs for L7 rules (HTTP path/method matching, DNS-aware policies).

### 5. Observability

**Hubble CLI** — real-time flow inspection:
```bash
hubble observe --namespace croc-shop-frontend
hubble observe --verdict DROPPED
```

**Hubble UI** — visual service dependency map:
```bash
kubectl port-forward -n kube-system svc/hubble-ui 12000:80
# Open: http://localhost:12000
```

**Metrics**:
- Prometheus scrapes all namespaces
- Grafana dashboards show cross-namespace traffic

## Deployment Workflow

### 1. Create Namespaces
```bash
kubectl apply -f k8s/base/namespaces.yaml
```

Cilium runs as a DaemonSet in `kube-system` — no per-namespace injection labels are needed.

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

### 3. Apply Network Policies
```bash
# Standard Kubernetes NetworkPolicies (enforced by Cilium)
kubectl apply -f k8s/base/network-policy.yaml
```

### 4. Deploy Gateway API Resources
```bash
# Gateway, HTTPRoutes, and ReferenceGrants for cross-namespace routing
kubectl apply -f k8s/gateway/
```

### 5. Deploy Monitoring
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

### Verify Cilium Status
```bash
cilium status
cilium connectivity test
```

### Check Cilium Network Policies
```bash
kubectl get cnp --all-namespaces
kubectl get networkpolicies --all-namespaces
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
- Transparent encryption via WireGuard (if enabled)

### 2. **Resource Management**
- Per-namespace resource quotas
- Independent scaling policies
- Isolated resource limits

### 3. **Team Autonomy**
- Different teams can own different namespaces
- Independent deployment cycles
- Namespace-level access control

### 4. **Service Mesh Capabilities**
- Demonstrates advanced Cilium service mesh features
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
kubectl get cnp -n <namespace>
```

2. **Inspect dropped traffic with Hubble**:
```bash
hubble observe --namespace <namespace> --verdict DROPPED
```

3. **Verify Cilium endpoint health**:
```bash
kubectl -n kube-system exec ds/cilium -- cilium endpoint list
```

4. **Check Cilium status**:
```bash
cilium status
cilium connectivity test
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
2. **Implement NetworkPolicies** to restrict traffic
3. **Use CiliumNetworkPolicy** for L7-aware security when needed
4. **Use Hubble** to inspect dropped flows when debugging connectivity
5. **Monitor cross-namespace traffic** via Hubble UI
6. **Set resource quotas** per namespace
7. **Use consistent labeling** across namespaces
8. **Document service dependencies** between namespaces

## Conclusion

This multi-namespace architecture demonstrates enterprise-grade Kubernetes and service mesh patterns. It showcases:
- Advanced Cilium service mesh capabilities
- Cross-namespace security and communication
- Production-ready observability
- Scalable microservices architecture

Perfect for learning and demonstrating cloud-native best practices!
