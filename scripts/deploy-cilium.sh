#!/bin/bash

# Deploy Crocs Shop to RKE2 cluster with Cilium CNI + Gateway API
# Cluster: cilium-ai-defense (RKE2 on AWS EC2, Rancher managed)
# Cilium: v1.18.6 (Helm), Gateway API, Hubble, ClusterMesh
#
# Prerequisites:
#   - Cilium installed via Helm (see docs/infrastructure/configure-cilium-in-aws.md)
#   - Gateway API CRDs installed
#   - cert-manager installed with letsencrypt-prod ClusterIssuer
#   - kubectl configured with cluster kubeconfig

set -e

echo "============================================"
echo "Deploying Crocs Shop (Cilium Gateway API)"
echo "============================================"
echo ""

# Preflight checks
echo "[1/7] Preflight checks..."
if ! command -v cilium &> /dev/null; then
    echo "Warning: cilium CLI not found. Skipping Cilium status check."
else
    cilium status || { echo "Error: Cilium is not healthy. Fix before deploying."; exit 1; }
fi

# Verify GatewayClass exists
if ! kubectl get gatewayclass cilium &> /dev/null; then
    echo "Error: GatewayClass 'cilium' not found."
    echo "Install Gateway API CRDs and enable gatewayAPI in Cilium Helm values."
    echo "See: docs/infrastructure/configure-cilium-in-aws.md"
    exit 1
fi
echo "  ✓ Cilium healthy, GatewayClass 'cilium' available"

# Create namespaces
echo ""
echo "[2/7] Creating namespaces..."
kubectl apply -f k8s/base/namespaces.yaml

# Deploy data layer first
echo ""
echo "[3/7] Deploying data layer (PostgreSQL + Redis)..."
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/redis-deployment.yaml
echo "  Waiting for databases..."
kubectl wait --for=condition=ready pod -l app=postgres -n croc-shop-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n croc-shop-data --timeout=300s
echo "  ✓ Databases ready"

# Deploy microservices
echo ""
echo "[4/7] Deploying microservices..."
kubectl apply -f k8s/base/product-catalog-deployment.yaml
kubectl apply -f k8s/base/user-deployment.yaml
kubectl apply -f k8s/base/cart-deployment.yaml
kubectl apply -f k8s/base/order-deployment.yaml
kubectl apply -f k8s/base/frontend-deployment.yaml
echo "  Waiting for services..."
sleep 10
kubectl wait --for=condition=ready pod -l app=product-catalog -n croc-shop-product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=user -n croc-shop-user --timeout=300s
kubectl wait --for=condition=ready pod -l app=cart -n croc-shop-cart --timeout=300s
kubectl wait --for=condition=ready pod -l app=order -n croc-shop-order --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n croc-shop-frontend --timeout=300s
echo "  ✓ All microservices ready"

# Deploy network policies
echo ""
echo "[5/7] Deploying network policies..."
kubectl apply -f k8s/base/network-policy.yaml
echo "  ✓ Network policies applied (enforced by Cilium)"

# Deploy Gateway API resources
echo ""
echo "[6/7] Deploying Gateway API resources..."
kubectl apply -f k8s/gateway/
echo "  ✓ Gateway, HTTPRoutes, and ReferenceGrants applied"

# Deploy monitoring
echo ""
echo "[7/7] Deploying monitoring stack..."
kubectl apply -f k8s/monitoring/prometheus.yaml
kubectl apply -f k8s/monitoring/grafana.yaml
kubectl wait --for=condition=ready pod -l app=prometheus -n croc-shop-monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=grafana -n croc-shop-monitoring --timeout=300s
echo "  ✓ Prometheus + Grafana ready"

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Namespaces:"
echo "  ✓ croc-shop-frontend"
echo "  ✓ croc-shop-product-catalog"
echo "  ✓ croc-shop-user"
echo "  ✓ croc-shop-cart"
echo "  ✓ croc-shop-order"
echo "  ✓ croc-shop-data"
echo "  ✓ croc-shop-monitoring"
echo ""
echo "Gateway API:"
kubectl get gateway croc-shop-gateway 2>/dev/null || echo "  (gateway not yet programmed)"
echo ""
echo "HTTPRoutes:"
kubectl get httproutes 2>/dev/null || echo "  (no httproutes found)"
echo ""
echo "Access (port-forward):"
echo "  kubectl port-forward -n croc-shop-frontend svc/frontend 8080:80"
echo "  Open: http://localhost:8080"
echo ""
echo "Access (via Gateway API, once DNS configured):"
echo "  https://croc-shop.apo-llm-test.com"
echo ""
echo "Hubble:"
echo "  cilium hubble port-forward &"
echo "  hubble observe --namespace croc-shop-frontend"
echo "  kubectl port-forward -n kube-system svc/hubble-ui 12000:80"
echo "  Open: http://localhost:12000"
