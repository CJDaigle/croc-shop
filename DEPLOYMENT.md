# Deployment Guide

This guide covers building Docker images, pushing them to Docker Hub, and deploying the Crocs Shop application to a Kubernetes cluster running Cilium as the CNI and service mesh.

## Cluster Infrastructure

| Component | Value |
|-----------|-------|
| **Platform** | RKE2 on AWS EC2 (Rancher managed) |
| **Cluster name** | `cilium-ai-defense` |
| **Kubernetes** | v1.31.12+rke2r1 |
| **CNI** | Cilium v1.18.6 (Helm) |
| **Nodes** | 10 (3 control-plane, 5 workers, 2 gateway) |
| **Ingress** | Cilium Gateway API (replaces nginx-ingress) |
| **Observability** | Hubble (relay + UI), Prometheus, Grafana |
| **Storage** | Longhorn |
| **TLS** | cert-manager with Let's Encrypt |
| **Domain** | `apo-llm-test.com` (Route 53) |
| **ClusterMesh** | Enabled |

See [docs/infrastructure/](docs/infrastructure/) for cluster provisioning details.

## Prerequisites

- **Docker**: For building container images
- **Docker Hub Account**: For hosting container images (free account works)
  - Login to Docker Hub before building/pushing images:
    ```bash
    docker login
    ```
- **Kubernetes Cluster**: RKE2 provisioned via Rancher (see `docs/infrastructure/cluster.RKE2.yaml`)
- **kubectl CLI**: Configured with the cluster kubeconfig
- **Helm**: For installing Cilium and cert-manager
- **Cilium CLI**: For status checks and connectivity tests
  - Install: https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/
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
docker build -t $DOCKER_USERNAME/croc-shop-product-catalog:latest ./services/product-catalog
docker push $DOCKER_USERNAME/croc-shop-product-catalog:latest

# User Service (Node.js)
docker build -t $DOCKER_USERNAME/croc-shop-user:latest ./services/user
docker push $DOCKER_USERNAME/croc-shop-user:latest

# Cart Service (Python/Flask)
docker build -t $DOCKER_USERNAME/croc-shop-cart:latest ./services/cart
docker push $DOCKER_USERNAME/croc-shop-cart:latest

# Order Service (Go)
docker build -t $DOCKER_USERNAME/croc-shop-order:latest ./services/order
docker push $DOCKER_USERNAME/croc-shop-order:latest

# Frontend Service (React)
docker build -t $DOCKER_USERNAME/croc-shop-frontend:latest ./services/frontend
docker push $DOCKER_USERNAME/croc-shop-frontend:latest
```

3. **Verify images on Docker Hub**
   - Visit: https://hub.docker.com/u/yourusername
   - You should see all 5 images listed

## Step 3: Update Kubernetes Manifests

Update all deployment manifests to use your Docker Hub images:

```bash
# Replace 'yourusername' with your actual Docker Hub username in all deployment files
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: product-catalog:latest|image: $DOCKER_USERNAME/croc-shop-product-catalog:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: user:latest|image: $DOCKER_USERNAME/croc-shop-user:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: cart:latest|image: $DOCKER_USERNAME/croc-shop-cart:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: order:latest|image: $DOCKER_USERNAME/croc-shop-order:latest|g" {} \;
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|image: frontend:latest|image: $DOCKER_USERNAME/croc-shop-frontend:latest|g" {} \;

# Update imagePullPolicy to Always (to pull from Docker Hub)
find k8s/base -name "*-deployment.yaml" -type f -exec sed -i '' "s|imagePullPolicy: IfNotPresent|imagePullPolicy: Always|g" {} \;
```

**Note for Linux users**: Remove the empty quotes after `-i` in the sed commands:
```bash
sed -i "s|pattern|replacement|g" file
```

## Step 4: Install Cilium (CNI + Service Mesh)

> **Note:** The RKE2 cluster is provisioned with `cni: none` and `rke2-ingress-nginx` disabled.
> Cilium provides all networking, and Gateway API replaces the nginx ingress controller.
> See `docs/infrastructure/configure-cilium-in-aws.md` for full setup details.

1. **Install Gateway API CRDs** (must be done before Cilium)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
   ```

2. **Install Cilium via Helm**
   ```bash
   helm repo add cilium https://helm.cilium.io/
   helm repo update

   helm install cilium cilium/cilium \
     --namespace kube-system \
     -f docs/infrastructure/cilium-values.yaml
   ```

   Or with explicit flags:
   ```bash
   helm install cilium cilium/cilium \
     --namespace kube-system \
     --set cluster.name=cluster-1 \
     --set cluster.id=1 \
     --set hubble.enabled=true \
     --set hubble.relay.enabled=true \
     --set hubble.ui.enabled=true \
     --set hubble.metrics.enabled="{dns,drop,tcp,flow,icmp,http}" \
     --set gatewayAPI.enabled=true \
     --set clustermesh.useAPIServer=true
   ```

3. **Enable Gateway API features** (apply overrides on top of base values)
   ```bash
   helm upgrade cilium cilium/cilium \
     --namespace kube-system \
     --version 1.18.6 \
     -f docs/infrastructure/cilium-values.yaml \
     -f docs/infrastructure/cilium-overrides.yaml
   ```

4. **Verify the installation**
   ```bash
   cilium status --wait
   kubectl get gatewayclasses
   # Should show: cilium   io.cilium/gateway-controller   True
   ```

5. **Install cert-manager** (for TLS via Let's Encrypt)
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
   ```

## Step 5: Deploy to Kubernetes Cluster

### Option A: Using Automated Deployment Script (Recommended)

```bash
# Make scripts executable
chmod +x scripts/deploy-cilium.sh
chmod +x scripts/deploy-monitoring.sh

# Deploy application with Cilium service mesh
./scripts/deploy-cilium.sh

# Deploy monitoring stack
./scripts/deploy-monitoring.sh
```

The script will:
- Create all 7 namespaces
- Deploy PostgreSQL and Redis to `croc-shop-data` namespace
- Deploy all microservices to their respective namespaces
- Apply network policies (enforced by Cilium)
- Deploy Gateway API resources (Gateway + HTTPRoutes + ReferenceGrants)
- Deploy Prometheus and Grafana to `croc-shop-monitoring` namespace

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
   kubectl wait --for=condition=ready pod -l app=postgres -n croc-shop-data --timeout=300s
   kubectl wait --for=condition=ready pod -l app=redis -n croc-shop-data --timeout=300s
   ```

3. **Deploy microservices**
   ```bash
   kubectl apply -f k8s/base/product-catalog-deployment.yaml
   kubectl apply -f k8s/base/user-deployment.yaml
   kubectl apply -f k8s/base/cart-deployment.yaml
   kubectl apply -f k8s/base/order-deployment.yaml
   kubectl apply -f k8s/base/frontend-deployment.yaml
   
   # Wait for services to be ready
   kubectl wait --for=condition=ready pod -l app=product-catalog -n croc-shop-product-catalog --timeout=300s
   kubectl wait --for=condition=ready pod -l app=user -n croc-shop-user --timeout=300s
   kubectl wait --for=condition=ready pod -l app=cart -n croc-shop-cart --timeout=300s
   kubectl wait --for=condition=ready pod -l app=order -n croc-shop-order --timeout=300s
   kubectl wait --for=condition=ready pod -l app=frontend -n croc-shop-frontend --timeout=300s
   ```

4. **Deploy network policies and Gateway API routing**
   ```bash
   # Network policies (enforced by Cilium at the eBPF level)
   kubectl apply -f k8s/base/network-policy.yaml

   # Gateway API resources (Gateway, HTTPRoutes, ReferenceGrants)
   kubectl apply -f k8s/gateway/
   ```

5. **Deploy monitoring stack**
   ```bash
   kubectl apply -f k8s/monitoring/prometheus.yaml
   kubectl apply -f k8s/monitoring/grafana.yaml
   
   # Wait for monitoring to be ready
   kubectl wait --for=condition=ready pod -l app=prometheus -n croc-shop-monitoring --timeout=300s
   kubectl wait --for=condition=ready pod -l app=grafana -n croc-shop-monitoring --timeout=300s
   ```

## Step 6: Access the Application

### Via Cilium Gateway API (production)

Traffic flows through the dedicated gateway nodes via Cilium's Gateway API:

```
Internet → DNS (croc-shop.apo-llm-test.com) → Gateway Nodes (hostNetwork)
                                                      │
                                            Cilium Gateway API (Envoy)
                                                      │
                                            HTTPRoute path matching
                                                      │
                              ┌──────────┬──────────┬──────────┬──────────┐
                              ▼          ▼          ▼          ▼          ▼
                           frontend  product-   user       cart       order
                                     catalog
```

```bash
# Check Gateway status
kubectl get gateway croc-shop-gateway
kubectl get httproutes

# Application URL (once DNS is configured)
# https://croc-shop.apo-llm-test.com
```

### Via port-forward (development / debugging)
```bash
kubectl port-forward -n croc-shop-frontend svc/frontend 8080:80
# Access at: http://localhost:8080
```

### Access Monitoring Dashboards

**Prometheus:**
```bash
kubectl port-forward -n croc-shop-monitoring svc/prometheus 9090:9090
# Open: http://localhost:9090
```

**Grafana:**
```bash
kubectl port-forward -n croc-shop-monitoring svc/grafana 3000:3000
# Open: http://localhost:3000
# Default credentials: admin/admin
```

**Hubble (Cilium Observability):**
```bash
# Hubble CLI — observe real-time traffic flows
cilium hubble port-forward &
hubble observe --namespace croc-shop-frontend

# Hubble UI — visual service map
kubectl port-forward -n kube-system svc/hubble-ui 12000:80
# Open: http://localhost:12000
```

## Step 7: Verification

### Check All Namespaces
```bash
kubectl get namespaces -l app=croc-shop
```

Expected output:
```
NAME                          STATUS   AGE
croc-shop-cart               Active   5m
croc-shop-data               Active   5m
croc-shop-frontend           Active   5m
croc-shop-monitoring         Active   5m
croc-shop-order              Active   5m
croc-shop-product-catalog    Active   5m
croc-shop-user               Active   5m
```

### Check All Pods Across Namespaces
```bash
kubectl get pods --all-namespaces -l app=croc-shop
```

All pods should show `1/1` READY and `Running` status.

### Check Services
```bash
kubectl get svc --all-namespaces -l app=croc-shop
```

### Verify Cilium Status
```bash
# Check Cilium is healthy across the cluster
cilium status

# Run a connectivity test
cilium connectivity test
```

### Test Cross-Namespace Communication
```bash
# Exec into frontend pod
kubectl exec -it -n croc-shop-frontend $(kubectl get pod -n croc-shop-frontend -l app=frontend -o jsonpath='{.items[0].metadata.name}') -c frontend -- sh

# Test connection to product catalog in different namespace
curl http://product-catalog.croc-shop-product-catalog.svc.cluster.local:3001/api/products
```

### Check Cilium Network Policies
```bash
# View all network policies enforced by Cilium
kubectl get cnp --all-namespaces
kubectl get networkpolicies --all-namespaces

# Check Cilium endpoint status
kubectl -n kube-system exec ds/cilium -- cilium endpoint list

# Observe traffic flows with Hubble
hubble observe --namespace croc-shop-frontend --follow
```

### Test API Endpoints via Port-Forward
```bash
# Product Catalog
kubectl port-forward -n croc-shop-product-catalog svc/product-catalog 3001:3001
curl http://localhost:3001/api/products

# User Service
kubectl port-forward -n croc-shop-user svc/user 3002:3002
curl http://localhost:3002/health

# Cart Service
kubectl port-forward -n croc-shop-cart svc/cart 3003:3003
curl http://localhost:3003/health

# Order Service
kubectl port-forward -n croc-shop-order svc/order 3004:3004
curl http://localhost:3004/health
```

## Scaling

### Check Horizontal Pod Autoscalers
```bash
kubectl get hpa -n croc-shop-product-catalog
kubectl get hpa -n croc-shop-user
kubectl get hpa -n croc-shop-cart
kubectl get hpa -n croc-shop-order
```

### Manual Scaling
```bash
# Scale product catalog to 5 replicas
kubectl scale deployment product-catalog -n croc-shop-product-catalog --replicas=5

# Verify
kubectl get pods -n croc-shop-product-catalog
```

### Auto-scaling
HPA is already configured and will automatically scale based on CPU/memory usage (50% threshold).

## Troubleshooting

### View Logs

**Application logs:**
```bash
# Product Catalog
kubectl logs -n croc-shop-product-catalog -l app=product-catalog --tail=100 -f

# User Service
kubectl logs -n croc-shop-user -l app=user --tail=100 -f

# Cart Service
kubectl logs -n croc-shop-cart -l app=cart --tail=100 -f

# Order Service
kubectl logs -n croc-shop-order -l app=order --tail=100 -f
```

**Cilium agent logs:**
```bash
kubectl -n kube-system logs -l k8s-app=cilium --tail=100 -f
```

### Debug Pod Issues

**Describe pod:**
```bash
kubectl describe pod -n croc-shop-product-catalog <pod-name>
```

**Get events:**
```bash
kubectl get events -n croc-shop-product-catalog --sort-by='.lastTimestamp'
```

**Execute into pod:**
```bash
kubectl exec -it -n croc-shop-product-catalog <pod-name> -c product-catalog -- /bin/sh
```

### Common Issues

#### 1. ImagePullBackOff Error
**Problem:** Kubernetes can't pull images from Docker Hub

**Solution:**
```bash
# Verify image exists on Docker Hub
docker pull $DOCKER_USERNAME/croc-shop-product-catalog:latest

# Check if image name in deployment is correct
kubectl get deployment -n croc-shop-product-catalog product-catalog -o yaml | grep image:

# If using private Docker Hub repo, create image pull secret
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email=$DOCKER_EMAIL \
  -n croc-shop-product-catalog

# Add to deployment
kubectl patch serviceaccount default -n croc-shop-product-catalog \
  -p '{"imagePullSecrets": [{"name": "dockerhub-secret"}]}'
```

#### 2. Database Connection Errors
**Problem:** Services can't connect to PostgreSQL or Redis

**Solution:**
```bash
# Verify databases are running
kubectl get pods -n croc-shop-data

# Check database service endpoints
kubectl get endpoints -n croc-shop-data

# Test connection from a service pod
kubectl exec -it -n croc-shop-product-catalog <pod-name> -c product-catalog -- sh
# Inside pod:
nc -zv postgres.croc-shop-data.svc.cluster.local 5432
```

#### 3. Cross-Namespace Communication Blocked
**Problem:** Services in different namespaces can't communicate

**Solution:**
```bash
# Check network policies
kubectl get networkpolicies --all-namespaces
kubectl get cnp --all-namespaces

# Use Hubble to inspect dropped traffic
hubble observe --namespace croc-shop-frontend --verdict DROPPED

# Verify namespace labels
kubectl get namespace croc-shop-frontend --show-labels

# Check Cilium endpoint health
kubectl -n kube-system exec ds/cilium -- cilium endpoint list
```

#### 4. Cilium Not Running Properly
**Problem:** Network connectivity issues or policy not enforcing

**Solution:**
```bash
# Check Cilium status
cilium status

# Check Cilium pods are running
kubectl get pods -n kube-system -l k8s-app=cilium

# Run Cilium connectivity test
cilium connectivity test

# Restart Cilium if needed
kubectl -n kube-system rollout restart ds/cilium
```

#### 5. Hubble Not Showing Flows
**Problem:** Hubble UI or CLI shows no traffic data

**Solution:**
```bash
# Hubble is enabled via Helm values (hubble.enabled=true)
# Check Hubble relay is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-relay

# Port-forward and test
cilium hubble port-forward &
hubble status
hubble observe --follow
```

## Cleanup

### Remove Application
```bash
# Use cleanup script
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh

# Or manually delete namespaces
kubectl delete namespace croc-shop-frontend
kubectl delete namespace croc-shop-product-catalog
kubectl delete namespace croc-shop-user
kubectl delete namespace croc-shop-cart
kubectl delete namespace croc-shop-order
kubectl delete namespace croc-shop-data
kubectl delete namespace croc-shop-monitoring
```

### Remove Cilium (if desired)
```bash
# Cilium was installed via Helm, so uninstall via Helm:
helm uninstall cilium -n kube-system

# Or use the Cilium CLI:
cilium uninstall
```

## Updating Images

When you make changes to your code and want to update the deployment:

1. **Rebuild and push images**
   ```bash
   # Rebuild specific service
   docker build -t $DOCKER_USERNAME/croc-shop-product-catalog:v1.1 ./services/product-catalog
   docker push $DOCKER_USERNAME/croc-shop-product-catalog:v1.1
   ```

2. **Update deployment**
   ```bash
   # Update image in deployment
   kubectl set image deployment/product-catalog \
     product-catalog=$DOCKER_USERNAME/croc-shop-product-catalog:v1.1 \
     -n croc-shop-product-catalog
   
   # Or use rolling update
   kubectl rollout restart deployment/product-catalog -n croc-shop-product-catalog
   ```

3. **Monitor rollout**
   ```bash
   kubectl rollout status deployment/product-catalog -n croc-shop-product-catalog
   ```

## Production Considerations

### 1. Image Versioning
- Use semantic versioning tags instead of `latest`
- Example: `$DOCKER_USERNAME/croc-shop-product-catalog:v1.0.0`
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
- Longhorn provides distributed block storage across the cluster
- Implement backup strategies for PostgreSQL
- Use StatefulSets for stateful workloads

### Product Catalog Data
- The Product Catalog service persists products in PostgreSQL.
- On startup, the service will automatically initialize the `products` table (if missing) and seed the catalog (if empty).

### 6. TLS/SSL
- cert-manager is installed with `letsencrypt-prod` ClusterIssuer
- TLS termination at the Cilium Gateway API layer (Envoy on gateway nodes)
- Certificates auto-provisioned via Let's Encrypt HTTP-01 challenge

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
- Keep Kubernetes and Cilium updated

## Additional Resources

- **Infrastructure Setup**: See `docs/infrastructure/configure-cilium-in-aws.md`
- **Gateway API Recap**: See `docs/infrastructure/cilium-gateway-recap.md`
- **Cilium Helm Values**: See `docs/infrastructure/cilium-values.yaml`
- **Cluster Definition**: See `docs/infrastructure/cluster.RKE2.yaml`
- **Multi-Namespace Guide**: See `MULTI-NAMESPACE-GUIDE.md`
- **Architecture Overview**: See `ARCHITECTURE.md`
- **Kubernetes Documentation**: https://kubernetes.io/docs/
- **Cilium Documentation**: https://docs.cilium.io/en/stable/
- **Gateway API Docs**: https://gateway-api.sigs.k8s.io/
- **Hubble Documentation**: https://docs.cilium.io/en/stable/observability/hubble/
