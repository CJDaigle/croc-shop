#!/bin/bash

# Prometheus PVC Migration Script
# Safely migrate Prometheus to use persistent storage

set -euo pipefail

KUBECONFIG="/Users/cdaigle/Documents/GitHub/croc-shop/.kube/config"
NAMESPACE="monitoring"

echo "🔄 Prometheus PVC Migration Script"
echo "================================="

# Check current Prometheus status
echo "📊 Checking current Prometheus deployment..."
kubectl get deployment prometheus -n $NAMESPACE -o yaml | grep -A 5 -B 5 "volumeMounts\|volumes" || echo "No volumes found"

# Check current data size
echo "📈 Current Prometheus data size:"
kubectl exec -n $NAMESPACE deployment/prometheus -- du -sh /prometheus 2>/dev/null || echo "Could not check data size"

# Check if PVC already exists
if kubectl get pvc prometheus-pvc -n $NAMESPACE >/dev/null 2>&1; then
    echo "⚠️  PVC prometheus-pvc already exists"
    echo "Do you want to continue and potentially recreate it? (y/N)"
    read -r response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        echo "❌ Migration cancelled"
        exit 0
    fi
fi

echo "🔧 Step 1: Creating PVC..."
kubectl apply -f prometheus-pvc.yaml

echo "⏳ Step 2: Waiting for PVC to be bound..."
kubectl wait --for=condition=Bound pvc/prometheus-pvc -n $NAMESPACE --timeout=300s

echo "🔧 Step 3: Backing up current Prometheus deployment..."
kubectl get deployment prometheus -n $NAMESPACE -o yaml > prometheus-deployment-backup.yaml

echo "🔧 Step 4: Updating Prometheus deployment with PVC..."
kubectl apply -f prometheus-with-pvc.yaml

echo "⏳ Step 5: Waiting for Prometheus to be ready..."
kubectl rollout status deployment/prometheus -n $NAMESPACE --timeout=300s

echo "📊 Step 6: Verifying PVC mount..."
kubectl get pods -n $NAMESPACE -l app=prometheus -o wide
kubectl exec -n $NAMESPACE deployment/prometheus -- df -h /prometheus 2>/dev/null || echo "Could not check mount"

echo "📈 Step 7: Checking Prometheus health..."
kubectl exec -n $NAMESPACE deployment/prometheus -- curl -s http://localhost:9090/-/healthy || echo "Could not check health"

echo "✅ Migration completed successfully!"
echo ""
echo "📋 Post-migration checklist:"
echo "1. Verify Prometheus is accessible: http://localhost:9090"
echo "2. Check that metrics data is preserved"
echo "3. Verify targets are still scraping"
echo "4. Check retention settings (30d, 50GB)"
echo "5. Monitor storage usage growth"
echo ""
echo "🔄 If needed, you can rollback with:"
echo "kubectl apply -f prometheus-deployment-backup.yaml"
