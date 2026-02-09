#!/bin/bash

set -e

echo "Deploying Crocs Shop with Istio (Multi-Namespace Service Mesh)..."

# Check if Istio is installed
if ! command -v istioctl &> /dev/null; then
    echo "Error: istioctl not found. Please install Istio first."
    echo "Visit: https://istio.io/latest/docs/setup/getting-started/"
    exit 1
fi

# Create namespaces with Istio injection
echo "Creating namespaces with Istio injection enabled..."
kubectl apply -f k8s/base/namespaces.yaml

# Deploy base resources
echo "Deploying base resources..."
kubectl apply -f k8s/base/

# Wait for databases
echo "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n crock-shop-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n crock-shop-data --timeout=300s

# Wait for services
echo "Waiting for services to be ready..."
sleep 10
kubectl wait --for=condition=ready pod -l app=product-catalog -n crock-shop-product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=user -n crock-shop-user --timeout=300s
kubectl wait --for=condition=ready pod -l app=cart -n crock-shop-cart --timeout=300s
kubectl wait --for=condition=ready pod -l app=order -n crock-shop-order --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n crock-shop-frontend --timeout=300s

# Deploy Istio configurations
echo "Deploying Istio Gateway and VirtualService..."
kubectl apply -f k8s/istio/gateway.yaml

echo "Deploying Istio DestinationRules..."
kubectl apply -f k8s/istio/destination-rules.yaml

echo "Deploying Istio ServiceEntries for cross-namespace communication..."
kubectl apply -f k8s/istio/service-entries.yaml

echo "Deploying Istio retry policies..."
kubectl apply -f k8s/istio/retry-policy.yaml

echo "Deploying Istio circuit breakers..."
kubectl apply -f k8s/istio/circuit-breaker.yaml

echo "Deploying Istio authorization policies..."
kubectl apply -f k8s/istio/authorization-policies.yaml

echo ""
echo "Multi-Namespace Service Mesh Deployment Complete!"
echo ""
echo "Namespaces with Istio sidecar injection:"
echo "  ✓ crock-shop-frontend"
echo "  ✓ crock-shop-product-catalog"
echo "  ✓ crock-shop-user"
echo "  ✓ crock-shop-cart"
echo "  ✓ crock-shop-order"
echo "  ✓ crock-shop-data"
echo "  ✓ crock-shop-monitoring"
echo ""
echo "Service Mesh Features Enabled:"
echo "  ✓ Cross-namespace service discovery (ServiceEntries)"
echo "  ✓ mTLS encryption between services"
echo "  ✓ Traffic management (DestinationRules)"
echo "  ✓ Retry policies and circuit breakers"
echo "  ✓ Authorization policies"
echo ""
echo "Get Istio Ingress Gateway URL:"
echo "  export INGRESS_HOST=\$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
echo "  export INGRESS_PORT=\$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name==\"http2\")].port}')"
echo "  echo \"http://\$INGRESS_HOST:\$INGRESS_PORT\""
echo ""
echo "Access Istio observability dashboards:"
echo "  Kiali (Service Graph): istioctl dashboard kiali"
echo "  Jaeger (Tracing): istioctl dashboard jaeger"
echo "  Grafana (Metrics): istioctl dashboard grafana"
echo ""
echo "Verify cross-namespace communication:"
echo "  kubectl get serviceentries --all-namespaces"
echo "  kubectl get authorizationpolicies --all-namespaces"
