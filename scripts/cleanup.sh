#!/bin/bash

set -e

echo "Cleaning up Crocs Shop deployment..."

# Delete Gateway API resources first (in default namespace, not deleted with app namespaces)
echo "Cleaning up Gateway API resources..."
kubectl delete gateway croc-shop-gateway --ignore-not-found=true
kubectl delete httproute croc-shop-route --ignore-not-found=true

# Delete ReferenceGrants (in app namespaces, but clean before namespace deletion)
echo "Cleaning up ReferenceGrants..."
for ns in croc-shop-frontend croc-shop-product-catalog croc-shop-user croc-shop-cart croc-shop-order; do
  kubectl delete referencegrants --all -n "$ns" --ignore-not-found=true 2>/dev/null
done

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

echo ""
echo "Cleanup complete!"
echo ""
echo "All croc-shop resources have been deleted:"
echo "  ✓ Gateway API resources (Gateway, HTTPRoute, ReferenceGrants)"
echo "  ✓ croc-shop-frontend"
echo "  ✓ croc-shop-product-catalog"
echo "  ✓ croc-shop-user"
echo "  ✓ croc-shop-cart"
echo "  ✓ croc-shop-order"
echo "  ✓ croc-shop-data"
echo "  ✓ croc-shop-monitoring"
echo ""
echo "To also remove Cilium (if desired):"
echo "  helm uninstall cilium -n kube-system"
