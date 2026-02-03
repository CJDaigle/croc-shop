# Deployment Guide

This guide covers deploying the Crock Shop application using Docker Compose and Kubernetes.

## Prerequisites

- Docker and Docker Compose
- Kubernetes cluster (minikube, kind, or cloud provider)
- kubectl CLI
- Istio (optional, for service mesh features)
- Helm (optional, for easier deployments)

## Local Development with Docker Compose

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crock-shop
   ```

2. **Build and run all services**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Product Catalog API: http://localhost:3001
   - User API: http://localhost:3002
   - Cart API: http://localhost:3003
   - Order API: http://localhost:3004

4. **Stop the application**
   ```bash
   docker-compose down
   ```

## Kubernetes Deployment

### Option 1: Without Istio (Basic Kubernetes)

1. **Build Docker images**
   ```bash
   # Build all service images
   docker build -t product-catalog:latest ./services/product-catalog
   docker build -t user:latest ./services/user
   docker build -t cart:latest ./services/cart
   docker build -t order:latest ./services/order
   docker build -t frontend:latest ./services/frontend
   ```

2. **Create namespace and deploy base resources**
   ```bash
   kubectl apply -f k8s/base/namespace.yaml
   kubectl apply -f k8s/base/postgres-deployment.yaml
   kubectl apply -f k8s/base/redis-deployment.yaml
   ```

3. **Wait for databases to be ready**
   ```bash
   kubectl wait --for=condition=ready pod -l app=postgres -n crock-shop --timeout=300s
   kubectl wait --for=condition=ready pod -l app=redis -n crock-shop --timeout=300s
   ```

4. **Deploy microservices**
   ```bash
   kubectl apply -f k8s/base/product-catalog-deployment.yaml
   kubectl apply -f k8s/base/user-deployment.yaml
   kubectl apply -f k8s/base/cart-deployment.yaml
   kubectl apply -f k8s/base/order-deployment.yaml
   kubectl apply -f k8s/base/frontend-deployment.yaml
   ```

5. **Deploy ingress (optional)**
   ```bash
   # Install nginx ingress controller first
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
   
   # Apply ingress rules
   kubectl apply -f k8s/base/ingress.yaml
   ```

6. **Apply network policies (optional)**
   ```bash
   kubectl apply -f k8s/base/network-policy.yaml
   ```

### Option 2: With Istio Service Mesh

1. **Install Istio**
   ```bash
   # Download Istio
   curl -L https://istio.io/downloadIstio | sh -
   cd istio-*
   export PATH=$PWD/bin:$PATH
   
   # Install Istio
   istioctl install --set profile=demo -y
   ```

2. **Deploy application with Istio**
   ```bash
   # Create namespace with Istio injection enabled
   kubectl apply -f k8s/base/namespace.yaml
   
   # Deploy all base resources
   kubectl apply -f k8s/base/
   
   # Deploy Istio configurations
   kubectl apply -f k8s/istio/gateway.yaml
   kubectl apply -f k8s/istio/destination-rules.yaml
   kubectl apply -f k8s/istio/retry-policy.yaml
   kubectl apply -f k8s/istio/circuit-breaker.yaml
   kubectl apply -f k8s/istio/rate-limiting.yaml
   ```

3. **Get Istio Ingress Gateway URL**
   ```bash
   export INGRESS_HOST=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   export INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].port}')
   export GATEWAY_URL=$INGRESS_HOST:$INGRESS_PORT
   
   echo "Access the application at: http://$GATEWAY_URL"
   ```

### Deploy Monitoring Stack

1. **Deploy Prometheus**
   ```bash
   kubectl apply -f k8s/monitoring/prometheus.yaml
   ```

2. **Deploy Grafana**
   ```bash
   kubectl apply -f k8s/monitoring/grafana.yaml
   ```

3. **Access monitoring dashboards**
   ```bash
   # Prometheus
   kubectl port-forward -n crock-shop svc/prometheus 9090:9090
   # Access at http://localhost:9090
   
   # Grafana (default credentials: admin/admin)
   kubectl port-forward -n crock-shop svc/grafana 3000:3000
   # Access at http://localhost:3000
   ```

4. **Access Istio observability tools (if using Istio)**
   ```bash
   # Kiali (Service Mesh Dashboard)
   istioctl dashboard kiali
   
   # Jaeger (Distributed Tracing)
   istioctl dashboard jaeger
   
   # Grafana (Istio Metrics)
   istioctl dashboard grafana
   ```

## Verification

### Check Pod Status
```bash
kubectl get pods -n crock-shop
```

All pods should be in `Running` state with `2/2` containers ready (if using Istio).

### Check Services
```bash
kubectl get svc -n crock-shop
```

### Test API Endpoints
```bash
# Product Catalog
kubectl port-forward -n crock-shop svc/product-catalog 3001:3001
curl http://localhost:3001/api/products

# User Service
kubectl port-forward -n crock-shop svc/user 3002:3002
curl http://localhost:3002/health

# Cart Service
kubectl port-forward -n crock-shop svc/cart 3003:3003
curl http://localhost:3003/health

# Order Service
kubectl port-forward -n crock-shop svc/order 3004:3004
curl http://localhost:3004/health
```

## Scaling

### Manual Scaling
```bash
kubectl scale deployment product-catalog -n crock-shop --replicas=5
```

### Auto-scaling (HPA already configured)
The HorizontalPodAutoscaler resources are already applied and will automatically scale based on CPU/memory usage.

Check HPA status:
```bash
kubectl get hpa -n crock-shop
```

## Troubleshooting

### View Logs
```bash
# View logs for a specific service
kubectl logs -n crock-shop -l app=product-catalog --tail=100

# Follow logs
kubectl logs -n crock-shop -l app=product-catalog -f

# View Istio sidecar logs
kubectl logs -n crock-shop <pod-name> -c istio-proxy
```

### Debug Pod Issues
```bash
# Describe pod
kubectl describe pod -n crock-shop <pod-name>

# Get events
kubectl get events -n crock-shop --sort-by='.lastTimestamp'

# Execute into pod
kubectl exec -it -n crock-shop <pod-name> -- /bin/sh
```

### Common Issues

1. **Pods not starting**: Check image pull policy and ensure images are built
2. **Database connection errors**: Verify postgres and redis pods are running
3. **Service mesh issues**: Ensure Istio is properly installed and namespace has injection enabled

## Cleanup

### Remove application
```bash
kubectl delete namespace crock-shop
```

### Remove Istio
```bash
istioctl uninstall --purge -y
kubectl delete namespace istio-system
```

### Docker Compose cleanup
```bash
docker-compose down -v
```

## Production Considerations

1. **Secrets Management**: Use Kubernetes Secrets or external secret managers (Vault, AWS Secrets Manager)
2. **Persistent Storage**: Configure proper PersistentVolumes with backup strategies
3. **TLS/SSL**: Enable HTTPS with cert-manager and Let's Encrypt
4. **Resource Limits**: Adjust CPU/memory requests and limits based on load testing
5. **High Availability**: Run multiple replicas across different availability zones
6. **Monitoring**: Set up alerting rules in Prometheus
7. **Logging**: Integrate with centralized logging (ELK, Loki)
8. **CI/CD**: Implement automated deployment pipelines
9. **Database Backups**: Schedule regular PostgreSQL backups
10. **Security**: Enable Pod Security Policies, Network Policies, and RBAC
