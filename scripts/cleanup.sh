#!/bin/bash

set -e

echo "Cleaning up Crocs Shop deployment..."

# Delete all croc-shop namespaces
echo "Deleting all croc-shop namespaces and resources..."
kubectl delete namespace croc-shop --ignore-not-found=true
kubectl delete namespace croc-shop-frontend --ignore-not-found=true
kubectl delete namespace croc-shop-product-catalog --ignore-not-found=true
kubectl delete namespace croc-shop-user --ignore-not-found=true
kubectl delete namespace croc-shop-cart --ignore-not-found=true
kubectl delete namespace croc-shop-order --ignore-not-found=true
kubectl delete namespace croc-shop-data --ignore-not-found=true
kubectl delete namespace croc-shop-monitoring --ignore-not-found=true

# Delete Istio resources from istio-system namespace
echo "Cleaning up Istio Gateway and VirtualService..."
kubectl delete gateway croc-shop-gateway -n istio-system --ignore-not-found=true
kubectl delete virtualservice croc-shop-vs -n istio-system --ignore-not-found=true

echo ""
echo "Cleanup complete!"
echo ""
echo "All croc-shop namespaces have been deleted:"
echo "  ✓ croc-shop-frontend"
echo "  ✓ croc-shop-product-catalog"
echo "  ✓ croc-shop-user"
echo "  ✓ croc-shop-cart"
echo "  ✓ croc-shop-order"
echo "  ✓ croc-shop-data"
echo "  ✓ croc-shop-monitoring"
echo ""
echo "To also remove Istio (if installed):"
echo "  istioctl uninstall --purge -y"
echo "  kubectl delete namespace istio-system"
