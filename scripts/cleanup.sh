#!/bin/bash

set -e

echo "Cleaning up Crocs Shop deployment..."

# Delete all crock-shop namespaces
echo "Deleting all crock-shop namespaces and resources..."
kubectl delete namespace crock-shop-frontend --ignore-not-found=true
kubectl delete namespace crock-shop-product-catalog --ignore-not-found=true
kubectl delete namespace crock-shop-user --ignore-not-found=true
kubectl delete namespace crock-shop-cart --ignore-not-found=true
kubectl delete namespace crock-shop-order --ignore-not-found=true
kubectl delete namespace crock-shop-data --ignore-not-found=true
kubectl delete namespace crock-shop-monitoring --ignore-not-found=true

# Delete Istio resources from istio-system namespace
echo "Cleaning up Istio Gateway and VirtualService..."
kubectl delete gateway crock-shop-gateway -n istio-system --ignore-not-found=true
kubectl delete virtualservice crock-shop-vs -n istio-system --ignore-not-found=true

echo ""
echo "Cleanup complete!"
echo ""
echo "All crock-shop namespaces have been deleted:"
echo "  ✓ crock-shop-frontend"
echo "  ✓ crock-shop-product-catalog"
echo "  ✓ crock-shop-user"
echo "  ✓ crock-shop-cart"
echo "  ✓ crock-shop-order"
echo "  ✓ crock-shop-data"
echo "  ✓ crock-shop-monitoring"
echo ""
echo "To also remove Istio (if installed):"
echo "  istioctl uninstall --purge -y"
echo "  kubectl delete namespace istio-system"
