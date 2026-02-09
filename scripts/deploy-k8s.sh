#!/bin/bash

set -e

echo "Deploying Crocs Shop to Kubernetes (Multi-Namespace Architecture)..."

# Create namespaces
echo "Creating namespaces..."
kubectl apply -f k8s/base/namespaces.yaml

# Deploy databases
echo "Deploying databases..."
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/redis-deployment.yaml

# Wait for databases
echo "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n croc-shop-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n croc-shop-data --timeout=300s

# Deploy microservices
echo "Deploying microservices..."
kubectl apply -f k8s/base/product-catalog-deployment.yaml
kubectl apply -f k8s/base/user-deployment.yaml
kubectl apply -f k8s/base/cart-deployment.yaml
kubectl apply -f k8s/base/order-deployment.yaml
kubectl apply -f k8s/base/frontend-deployment.yaml

# Wait for services
echo "Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=product-catalog -n croc-shop-product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=user -n croc-shop-user --timeout=300s
kubectl wait --for=condition=ready pod -l app=cart -n croc-shop-cart --timeout=300s
kubectl wait --for=condition=ready pod -l app=order -n croc-shop-order --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n croc-shop-frontend --timeout=300s

# Deploy network policies
echo "Deploying network policies..."
kubectl apply -f k8s/base/network-policy.yaml

# Deploy ingress with ExternalName services
echo "Deploying ingress..."
kubectl apply -f k8s/base/ingress.yaml

echo ""
echo "Deployment complete!"
echo ""
echo "Namespaces created:"
echo "  - croc-shop-frontend (Frontend service)"
echo "  - croc-shop-product-catalog (Product Catalog service)"
echo "  - croc-shop-user (User service)"
echo "  - croc-shop-cart (Cart service)"
echo "  - croc-shop-order (Order service)"
echo "  - croc-shop-data (PostgreSQL & Redis)"
echo "  - croc-shop-monitoring (Prometheus & Grafana)"
echo ""
echo "Check status:"
echo "  kubectl get pods --all-namespaces -l app=croc-shop"
echo ""
echo "Access services:"
echo "  Frontend: kubectl port-forward -n croc-shop-frontend svc/frontend 8080:80"
echo "  Product Catalog: kubectl port-forward -n croc-shop-product-catalog svc/product-catalog 3001:3001"
