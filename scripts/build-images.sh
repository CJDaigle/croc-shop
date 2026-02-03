#!/bin/bash

set -e

echo "Building Docker images for Crock Shop..."

# Build product catalog service
echo "Building product-catalog service..."
docker build -t crock-shop/product-catalog:latest ./services/product-catalog

# Build user service
echo "Building user service..."
docker build -t crock-shop/user:latest ./services/user

# Build cart service
echo "Building cart service..."
docker build -t crock-shop/cart:latest ./services/cart

# Build order service
echo "Building order service..."
docker build -t crock-shop/order:latest ./services/order

# Build frontend
echo "Building frontend..."
docker build -t crock-shop/frontend:latest ./services/frontend

echo "All images built successfully!"
echo ""
echo "Images:"
docker images | grep "crock-shop/" | grep latest
