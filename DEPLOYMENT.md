# Deployment Guide

This guide covers building Docker images, pushing them to Docker Hub, and deploying the Crock Shop application to a Kubernetes cluster with Istio service mesh.

## Prerequisites

- **Docker**: For building container images
- **Docker Hub Account**: For hosting container images (free account works)
  - Login to Docker Hub before building/pushing images:
    ```bash
    docker login
    ```
- **Kubernetes Cluster**: 
  - Local: minikube, kind, Docker Desktop
  - Cloud: GKE, EKS, AKS, or any managed Kubernetes
- **kubectl CLI**: Configured to access your cluster
- **Istio**: For service mesh features (recommended)
- **Git**: To clone the repository

## Step 1: Setup Docker Hub

1. **Create a Docker Hub account** (if you don't have one)
   - Visit: https://hub.docker.com/signup
   - Choose a username (e.g., `yourusername`)

2. **Login to Docker Hub**
   ```bash
   docker login
   # Enter your Docker Hub username and password
   ```

3. **Set your Docker Hub username as an environment variable**
   ```bash
   export DOCKER_USERNAME=yourusername
   # Add to ~/.bashrc or ~/.zshrc to persist
   ```

## Step 2: Build and Push Docker Images

### Option A: Using the Build Script (Recommended)

1. **Update the build script with your Docker Hub username**
   ```bash
   # Edit scripts/build-images.sh and replace 'yourusername' with your Docker Hub username
   # Or use sed to replace it:
   sed -i '' "s/yourusername/$DOCKER_USERNAME/g" scripts/build-images.sh
   ```

2. **Build and push all images**
   ```bash
   chmod +x scripts/build-images.sh
   ./scripts/build-images.sh
   ```

   This will:
   - Build all 5 microservice images
   - Tag them with your Docker Hub username
   - Push them to Docker Hub

### Option B: Manual Build and Push

Build and push each service individually:

```bash
# Set your Docker Hub username
export DOCKER_USERNAME=yourusername

# Product Catalog Service (Node.js)
docker build -t $DOCKER_USERNAME/crock-shop-product-catalog:latest ./services/product-catalog
docker push $DOCKER_USERNAME/crock-shop-product-catalog:latest

# User Service (Node.js)
docker build -t $DOCKER_USERNAME/crock-shop-user:latest ./services/user
docker push $DOCKER_USERNAME/crock-shop-user:latest

# Cart Service (Python/Flask)
docker build -t $DOCKER_USERNAME/crock-shop-cart:latest ./services/cart
docker push $DOCKER_USERNAME/crock-shop-cart:latest

# Order Service (Go)
docker build -t $DOCKER_USERNAME/crock-shop-order:latest ./services/order
docker push $DOCKER_USERNAME/crock-shop-order:latest

# Frontend Service (React)
docker build -t $DOCKER_USERNAME/crock-shop-frontend:latest ./services/frontend
docker push $DOCKER_USERNAME/crock-shop-frontend:latest
```

3. **Verify images on Docker Hub**
   - Visit: https://hub.docker.com/u/yourusername
   - You should see all 5 images listed

## Step 3: Update Kubernetes Manifests

Update all deployment manifests to use your Docker Hub images:

```bash
# Replace 'yourusername' with your actual Docker Hub username in all deployment files
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: product-catalog:latest|image: $DOCKER_USERNAME/crock-shop-product-catalog:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: user:latest|image: $DOCKER_USERNAME/crock-shop-user:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: cart:latest|image: $DOCKER_USERNAME/crock-shop-cart:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: order:latest|image: $DOCKER_USERNAME/crock-shop-order:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: frontend:latest|image: $DOCKER_USERNAME/crock-shop-frontend:latest|g" {} \;

# Update imagePullPolicy to Always (to pull from Docker Hub)
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|imagePullPolicy: IfNotPresent|imagePullPolicy: Always|g" {} \;
```

**Note for Linux users**: Remove the empty quotes after `-i` in the sed commands:
```bash
sed -i "s|pattern|replacement|g" file
```

## Step 4: Install Istio (Service Mesh)

1. **Download and install Istio**
   ```bash
   # Download Istio
   curl -L https://istio.io/downloadIstio | sh -
   
   # Move to Istio directory
   cd istio-*
   
   # Add istioctl to PATH
   export PATH=$PWD/bin:$PATH
   
   # Return to project directory
   cd -
   ```

2. **Install Istio on your cluster**
   ```bash
   # Install with demo profile (includes observability tools)
   istioctl install --set profile=demo -y
   
   # Verify installation
   kubectl get pods -n istio-system
   ```

   Wait until all Istio pods are running.

## Step 5: Deploy to Kubernetes Cluster

### Option A: Using Automated Deployment Script (Recommended)

```bash
# Make scripts executable
chmod +x scripts/deploy-istio.sh
chmod +x scripts/deploy-monitoring.sh

# Deploy application with Istio service mesh
./scripts/deploy-istio.sh

# Deploy monitoring stack
./scripts/deploy-monitoring.sh
```

The script will:
- Create all 7 namespaces with Istio injection enabled
- Deploy PostgreSQL and Redis to `crock-shop-data` namespace
- Deploy all microservices to their respective namespaces
- Configure Istio Gateway, VirtualServices, and DestinationRules
- Set up ServiceEntries for cross-namespace communication
- Apply authorization policies and network policies
- Deploy Prometheus and Grafana to `crock-shop-monitoring` namespace

### Option B: Manual Step-by-Step Deployment

1. **Create all namespaces**
   ```bash
   kubectl apply -f k8s/base/namespaces.yaml
   ```

2. **Deploy data layer (PostgreSQL & Redis)**
   ```bash
   kubectl apply -f k8s/base/postgres-deployment.yaml
   kubectl apply -f k8s/base/redis-deployment.yaml
   
   # Wait for databases to be ready
   kubectl wait --for=condition=ready pod -l app=postgres -n crock-shop-data --timeout=300s
   kubectl wait --for=condition=ready pod -l app=redis -n crock-shop-data --timeout=300s
   ```

3. **Deploy microservices**
   ```bash
   kubectl apply -f k8s/base/product-catalog-deployment.yaml
   kubectl apply -f k8s/base/user-deployment.yaml
   kubectl apply -f k8s/base/cart-deployment.yaml
   kubectl apply -f k8s/base/order-deployment.yaml
   kubectl apply -f k8s/base/frontend-deployment.yaml
   
   # Wait for services to be ready
   kubectl wait --for=condition=ready pod -l app=product-catalog -n crock-shop-product-catalog --timeout=300s
   kubectl wait --for=condition=ready pod -l app=user -n crock-shop-user --timeout=300s
   kubectl wait --for=condition=ready pod -l app=cart -n crock-shop-cart --timeout=300s
   kubectl wait --for=condition=ready pod -l app=order -n crock-shop-order --timeout=300s
   kubectl wait --for=condition=ready pod -l app=frontend -n crock-shop-frontend --timeout=300s
   ```

4. **Deploy Istio configurations**
   ```bash
   # Gateway and VirtualService
   kubectl apply -f k8s/istio/gateway.yaml
   
   # Cross-namespace service discovery
   kubectl apply -f k8s/istio/service-entries.yaml
   
   # Traffic management
   kubectl apply -f k8s/istio/destination-rules.yaml
   kubectl apply -f k8s/istio/retry-policy.yaml
   kubectl apply -f k8s/istio/circuit-breaker.yaml
   
   # Security policies
   kubectl apply -f k8s/istio/authorization-policies.yaml
   
   # Network policies
   kubectl apply -f k8s/base/network-policy.yaml
   ```

5. **Deploy monitoring stack**
   ```bash
   kubectl apply -f k8s/monitoring/prometheus.yaml
   kubectl apply -f k8s/monitoring/grafana.yaml
   
   # Wait for monitoring to be ready
   kubectl wait --for=condition=ready pod -l app=prometheus -n crock-shop-monitoring --timeout=300s
   kubectl wait --for=condition=ready pod -l app=grafana -n crock-shop-monitoring --timeout=300s
   ```

## Step 6: Access the Application

### Get Istio Ingress Gateway URL

**For cloud clusters with LoadBalancer:**
```bash
export INGRESS_HOST=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
export INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].port}')
echo "Application URL: http://$INGRESS_HOST:$INGRESS_PORT"
```

**For local clusters (minikube, kind, Docker Desktop):**
```bash
# Use port-forward to access the gateway
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80

# Access at: http://localhost:8080
```

### Access Monitoring Dashboards

**Prometheus:**
```bash
kubectl port-forward -n crock-shop-monitoring svc/prometheus 9090:9090
# Open: http://localhost:9090
```

**Grafana:**
```bash
kubectl port-forward -n crock-shop-monitoring svc/grafana 3000:3000
# Open: http://localhost:3000
# Default credentials: admin/admin
```

**Istio Observability Tools:**
```bash
# Kiali (Service Mesh Topology)
istioctl dashboard kiali

# Jaeger (Distributed Tracing)
istioctl dashboard jaeger

# Grafana (Istio Metrics)
istioctl dashboard grafana
```

## Step 7: Verification

### Check All Namespaces
```bash
kubectl get namespaces -l app=crock-shop
```

Expected output:
```
NAME                          STATUS   AGE
crock-shop-cart               Active   5m
crock-shop-data               Active   5m
crock-shop-frontend           Active   5m
crock-shop-monitoring         Active   5m
crock-shop-order              Active   5m
crock-shop-product-catalog    Active   5m
crock-shop-user               Active   5m
```

### Check All Pods Across Namespaces
```bash
kubectl get pods --all-namespaces -l app=crock-shop
```

All pods should show `2/2` READY (application + Istio sidecar) and `Running` status.

### Check Services
```bash
kubectl get svc --all-namespaces -l app=crock-shop
```

### Verify Istio Sidecar Injection
```bash
# Check a pod has both application and istio-proxy containers
kubectl get pod -n crock-shop-frontend -l app=frontend -o jsonpath='{.items[0].spec.containers[*].name}'
# Should output: frontend istio-proxy
```

### Test Cross-Namespace Communication
```bash
# Exec into frontend pod
kubectl exec -it -n crock-shop-frontend $(kubectl get pod -n crock-shop-frontend -l app=frontend -o jsonpath='{.items[0].metadata.name}') -c frontend -- sh

# Test connection to product catalog in different namespace
curl http://product-catalog.crock-shop-product-catalog.svc.cluster.local:3001/api/products
```

### Check Istio Configuration
```bash
# View ServiceEntries
kubectl get serviceentries --all-namespaces

# View Authorization Policies
kubectl get authorizationpolicies --all-namespaces

# View DestinationRules
kubectl get destinationrules --all-namespaces

# View VirtualServices
kubectl get virtualservices --all-namespaces
```

### Test API Endpoints via Port-Forward
```bash
# Product Catalog
kubectl port-forward -n crock-shop-product-catalog svc/product-catalog 3001:3001
curl http://localhost:3001/api/products

# User Service
kubectl port-forward -n crock-shop-user svc/user 3002:3002
curl http://localhost:3002/health

# Cart Service
kubectl port-forward -n crock-shop-cart svc/cart 3003:3003
curl http://localhost:3003/health

# Order Service
kubectl port-forward -n crock-shop-order svc/order 3004:3004
curl http://localhost:3004/health
```

## Scaling

### Check Horizontal Pod Autoscalers
```bash
kubectl get hpa -n crock-shop-product-catalog
kubectl get hpa -n crock-shop-user
kubectl get hpa -n crock-shop-cart
kubectl get hpa -n crock-shop-order
```

### Manual Scaling
```bash
# Scale product catalog to 5 replicas
kubectl scale deployment product-catalog -n crock-shop-product-catalog --replicas=5

# Verify
kubectl get pods -n crock-shop-product-catalog
```

### Auto-scaling
HPA is already configured and will automatically scale based on CPU/memory usage (50% threshold).

## Troubleshooting

### View Logs

**Application logs:**
```bash
# Product Catalog
kubectl logs -n crock-shop-product-catalog -l app=product-catalog --tail=100 -f

# User Service
kubectl logs -n crock-shop-user -l app=user --tail=100 -f

# Cart Service
kubectl logs -n crock-shop-cart -l app=cart --tail=100 -f

# Order Service
kubectl logs -n crock-shop-order -l app=order --tail=100 -f
```

**Istio sidecar logs:**
```bash
kubectl logs -n crock-shop-product-catalog <pod-name> -c istio-proxy --tail=100
```

### Debug Pod Issues

**Describe pod:**
```bash
kubectl describe pod -n crock-shop-product-catalog <pod-name>
```

**Get events:**
```bash
kubectl get events -n crock-shop-product-catalog --sort-by='.lastTimestamp'
```

**Execute into pod:**
```bash
kubectl exec -it -n crock-shop-product-catalog <pod-name> -c product-catalog -- /bin/sh
```

### Common Issues

#### 1. ImagePullBackOff Error
**Problem:** Kubernetes can't pull images from Docker Hub

**Solution:**
```bash
# Verify image exists on Docker Hub
docker pull $DOCKER_USERNAME/crock-shop-product-catalog:latest

# Check if image name in deployment is correct
kubectl get deployment -n crock-shop-product-catalog product-catalog -o yaml | grep image:

# If using private Docker Hub repo, create image pull secret
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email=$DOCKER_EMAIL \
  -n crock-shop-product-catalog

# Add to deployment
kubectl patch serviceaccount default -n crock-shop-product-catalog \
  -p '{"imagePullSecrets": [{"name": "dockerhub-secret"}]}'
```

#### 2. Database Connection Errors
**Problem:** Services can't connect to PostgreSQL or Redis

**Solution:**
```bash
# Verify databases are running
kubectl get pods -n crock-shop-data

# Check database service endpoints
kubectl get endpoints -n crock-shop-data

# Test connection from a service pod
kubectl exec -it -n crock-shop-product-catalog <pod-name> -c product-catalog -- sh
# Inside pod:
nc -zv postgres.crock-shop-data.svc.cluster.local 5432
```

#### 3. Cross-Namespace Communication Blocked
**Problem:** Services in different namespaces can't communicate

**Solution:**
```bash
# Check ServiceEntries are created
kubectl get serviceentries --all-namespaces

# Check Authorization Policies
kubectl get authorizationpolicies --all-namespaces

# Check Network Policies
kubectl get networkpolicies --all-namespaces

# Verify namespace labels
kubectl get namespace crock-shop-frontend --show-labels
```

#### 4. Istio Sidecar Not Injected
**Problem:** Pods only show 1/1 containers instead of 2/2

**Solution:**
```bash
# Check namespace has istio-injection label
kubectl get namespace crock-shop-frontend -o yaml | grep istio-injection

# Add label if missing
kubectl label namespace crock-shop-frontend istio-injection=enabled

# Restart pods to inject sidecar
kubectl rollout restart deployment -n crock-shop-frontend
```

#### 5. Gateway Not Accessible
**Problem:** Can't access application through Istio gateway

**Solution:**
```bash
# Check Istio ingress gateway is running
kubectl get pods -n istio-system -l app=istio-ingressgateway

# Check gateway configuration
kubectl get gateway -n istio-system

# Check virtual service
kubectl get virtualservice -n istio-system

# For local clusters, use port-forward
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80
```

## Cleanup

### Remove Application
```bash
# Use cleanup script
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh

# Or manually delete namespaces
kubectl delete namespace crock-shop-frontend
kubectl delete namespace crock-shop-product-catalog
kubectl delete namespace crock-shop-user
kubectl delete namespace crock-shop-cart
kubectl delete namespace crock-shop-order
kubectl delete namespace crock-shop-data
kubectl delete namespace crock-shop-monitoring
```

### Remove Istio
```bash
istioctl uninstall --purge -y
kubectl delete namespace istio-system
```

## Updating Images

When you make changes to your code and want to update the deployment:

1. **Rebuild and push images**
   ```bash
   # Rebuild specific service
   docker build -t $DOCKER_USERNAME/crock-shop-product-catalog:v1.1 ./services/product-catalog
   docker push $DOCKER_USERNAME/crock-shop-product-catalog:v1.1
   ```

2. **Update deployment**
   ```bash
   # Update image in deployment
   kubectl set image deployment/product-catalog \
     product-catalog=$DOCKER_USERNAME/crock-shop-product-catalog:v1.1 \
     -n crock-shop-product-catalog
   
   # Or use rolling update
   kubectl rollout restart deployment/product-catalog -n crock-shop-product-catalog
   ```

3. **Monitor rollout**
   ```bash
   kubectl rollout status deployment/product-catalog -n crock-shop-product-catalog
   ```

## Production Considerations

### 1. Image Versioning
- Use semantic versioning tags instead of `latest`
- Example: `$DOCKER_USERNAME/crock-shop-product-catalog:v1.0.0`
- Update deployment manifests with specific versions

### 2. Secrets Management
- Never commit secrets to Git
- Use Kubernetes Secrets or external secret managers (Vault, AWS Secrets Manager, Google Secret Manager)
- Rotate secrets regularly

### 3. Resource Management
- Set appropriate resource requests and limits based on load testing
- Configure resource quotas per namespace
- Monitor resource usage in Grafana

### 4. High Availability
- Run multiple replicas across different availability zones
- Configure pod anti-affinity rules
- Use PodDisruptionBudgets

### 5. Persistent Storage
- Use cloud provider persistent volumes (EBS, GCE PD, Azure Disk)
- Implement backup strategies for PostgreSQL
- Use StatefulSets for stateful workloads

### 6. TLS/SSL
- Install cert-manager for automatic certificate management
- Configure HTTPS in Istio Gateway
- Use Let's Encrypt for free certificates

### 7. Monitoring & Alerting
- Set up Prometheus alerting rules
- Configure Grafana dashboards
- Integrate with PagerDuty or similar for on-call alerts

### 8. Logging
- Deploy centralized logging (ELK stack, Loki, or cloud provider solutions)
- Configure log retention policies
- Set up log-based alerts

### 9. CI/CD Pipeline
- Automate image builds on code commits
- Implement automated testing
- Use GitOps tools (ArgoCD, Flux) for deployment automation

### 10. Security
- Enable Pod Security Standards
- Implement RBAC policies
- Regular security scanning of container images
- Keep Kubernetes and Istio updated

## Additional Resources

- **Kubernetes Documentation**: https://kubernetes.io/docs/
- **Istio Documentation**: https://istio.io/latest/docs/
- **Docker Hub**: https://hub.docker.com/
- **Multi-Namespace Guide**: See `MULTI-NAMESPACE-GUIDE.md` for detailed architecture explanation
- **Architecture Overview**: See `ARCHITECTURE.md` for system design details
