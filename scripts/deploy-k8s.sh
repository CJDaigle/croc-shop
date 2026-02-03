#!/bin/bash

set -e

echo "Deploying Crock Shop to Kubernetes (Multi-Namespace Architecture)..."

# Create namespaces
echo "Creating namespaces..."
kubectl apply -f k8s/base/namespaces.yaml

# Deploy databases
echo "Deploying databases..."
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/redis-deployment.yaml

# Wait for databases
echo "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n crock-shop-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n crock-shop-data --timeout=300s

# Deploy microservices
echo "Deploying microservices..."
kubectl apply -f k8s/base/product-catalog-deployment.yaml
kubectl apply -f k8s/base/user-deployment.yaml
kubectl apply -f k8s/base/cart-deployment.yaml
kubectl apply -f k8s/base/order-deployment.yaml
kubectl apply -f k8s/base/frontend-deployment.yaml

# Wait for services
echo "Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=product-catalog -n crock-shop-product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=user -n crock-shop-user --timeout=300s
kubectl wait --for=condition=ready pod -l app=cart -n crock-shop-cart --timeout=300s
kubectl wait --for=condition=ready pod -l app=order -n crock-shop-order --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n crock-shop-frontend --timeout=300s

echo ""
echo "Deployment complete!"
echo ""
echo "Namespaces created:"
echo "  - crock-shop-frontend (Frontend service)"
echo "  - crock-shop-product-catalog (Product Catalog service)"
echo "  - crock-shop-user (User service)"
echo "  - crock-shop-cart (Cart service)"
echo "  - crock-shop-order (Order service)"
echo "  - crock-shop-data (PostgreSQL & Redis)"
echo "  - crock-shop-monitoring (Prometheus & Grafana)"
echo ""
echo "Check status:"
echo "  kubectl get pods --all-namespaces -l app=crock-shop"
echo ""
echo "Access services:"
echo "  Frontend: kubectl port-forward -n crock-shop-frontend svc/frontend 8080:80"
echo "  Product Catalog: kubectl port-forward -n crock-shop-product-catalog svc/product-catalog 3001:3001"
