#!/bin/bash

set -e

echo "Building Docker images for Crocs Shop..."

# Build product catalog service
echo "Building product-catalog service..."
docker build -t cjdaigle2/crock-shop:product-catalog ./services/product-catalog

# Build user service
echo "Building user service..."
docker build -t cjdaigle2/crock-shop:user ./services/user

# Build cart service
echo "Building cart service..."
docker build -t cjdaigle2/crock-shop:cart ./services/cart

# Build order service
echo "Building order service..."
docker build -t cjdaigle2/crock-shop:order ./services/order

# Build frontend
echo "Building frontend..."
docker build -t cjdaigle2/crock-shop:frontend ./services/frontend

echo "All images built successfully!"
echo ""
echo "Images:"
docker images | grep "cjdaigle2/crock-shop"
