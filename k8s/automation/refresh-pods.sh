#!/bin/bash

# Croc-Shop Pod Refresh Script
# Usage: ./refresh-pods.sh [namespace|all]

set -e

KUBECONFIG="/Users/cdaigle/Documents/GitHub/croc-shop/.kube/config"
NAMESPACE=${1:-"all"}

echo "🔄 Croc-Shop Pod Refresh Script"
echo "==============================="

# Function to refresh deployments in a namespace
refresh_namespace() {
    local ns=$1
    echo "📦 Refreshing deployments in namespace: $ns"
    
    # Get all deployments in the namespace
    deployments=$(kubectl get deployments -n $ns -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$deployments" ]; then
        echo "⚠️  No deployments found in namespace: $ns"
        return
    fi
    
    for deployment in $deployments; do
        echo "🔄 Restarting deployment: $deployment"
        
        # Restart the deployment
        kubectl rollout restart deployment/$deployment -n $ns
        
        # Wait for rollout to complete
        echo "⏳ Waiting for rollout to complete..."
        if kubectl rollout status deployment/$deployment -n $ns --timeout=300s; then
            echo "✅ $deployment refreshed successfully"
        else
            echo "❌ $deployment refresh failed - continuing with next deployment"
        fi
        
        echo "---"
    done
}

# Function to refresh all croc-shop services
refresh_croc_shop() {
    echo "🔄 Refreshing all Croc-Shop services..."
    
    services=("user" "cart" "order" "product-catalog" "chatbot")
    
    for service in "${services[@]}"; do
        namespace="croc-shop-$service"
        echo "📦 Refreshing $service in $namespace..."
        
        if kubectl get namespace $namespace >/dev/null 2>&1; then
            refresh_namespace $namespace
        else
            echo "⚠️  Namespace $namespace not found"
        fi
    done
}

# Function to refresh sock-shop services
refresh_sock_shop() {
    echo "🔄 Refreshing Sock-Shop services..."
    
    if kubectl get namespace sock-shop >/dev/null 2>&1; then
        refresh_namespace "sock-shop"
    else
        echo "⚠️  Sock-shop namespace not found"
    fi
}

# Main execution
case $NAMESPACE in
    "all")
        echo "🔄 Refreshing all services..."
        refresh_croc_shop
        refresh_sock_shop
        ;;
    "croc-shop")
        refresh_croc_shop
        ;;
    "sock-shop")
        refresh_sock_shop
        ;;
    *)
        if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
            refresh_namespace $NAMESPACE
        else
            echo "❌ Namespace '$NAMESPACE' not found"
            echo "Usage: $0 [namespace|all|croc-shop|sock-shop]"
            echo ""
            echo "Available options:"
            echo "  all         - Refresh all croc-shop and sock-shop services"
            echo "  croc-shop   - Refresh all croc-shop services"
            echo "  sock-shop   - Refresh sock-shop services"
            echo "  <namespace> - Refresh specific namespace"
            echo ""
            echo "Available namespaces:"
            kubectl get namespaces | grep -E "(croc-shop|sock-shop)" | awk '{print "  " $1}'
            exit 1
        fi
        ;;
esac

echo "🎉 Pod refresh completed at $(date)"
