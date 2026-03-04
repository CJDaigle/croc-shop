#!/bin/bash

# Grafana PVC Migration Script
# Safely migrate Grafana to use persistent storage

set -euo pipefail

KUBECONFIG="/Users/cdaigle/Documents/GitHub/croc-shop/.kube/config"
NAMESPACE="monitoring"

echo "🔄 Grafana PVC Migration Script"
echo "=============================="

# Check current Grafana status
echo "📊 Checking current Grafana deployment..."
kubectl get deployment grafana -n $NAMESPACE -o yaml | grep -A 5 -B 5 "volumeMounts\|volumes" || echo "No volumes found"

# Check if PVC already exists
if kubectl get pvc grafana-pvc -n $NAMESPACE >/dev/null 2>&1; then
    echo "⚠️  PVC grafana-pvc already exists"
    echo "Do you want to continue and potentially recreate it? (y/N)"
    read -r response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        echo "❌ Migration cancelled"
        exit 0
    fi
fi

echo "🔧 Step 1: Creating PVC..."
kubectl apply -f grafana-pvc.yaml

echo "⏳ Step 2: Waiting for PVC to be bound..."
kubectl wait --for=condition=Bound pvc/grafana-pvc -n $NAMESPACE --timeout=300s

echo "🔧 Step 3: Creating dashboard provisioning..."
kubectl apply -f grafana-dashboard-provisioning.yaml

echo "🔧 Step 4: Backing up current Grafana deployment..."
kubectl get deployment grafana -n $NAMESPACE -o yaml > grafana-deployment-backup.yaml

echo "🔧 Step 5: Updating Grafana deployment with PVC..."
kubectl apply -f grafana-with-pvc.yaml

echo "⏳ Step 6: Waiting for Grafana to be ready..."
kubectl rollout status deployment/grafana -n $NAMESPACE --timeout=300s

echo "📊 Step 7: Verifying PVC mount..."
kubectl get pods -n $NAMESPACE -l app=grafana -o wide
kubectl exec -n $NAMESPACE deployment/grafana -- df -h /var/lib/grafana 2>/dev/null || echo "Could not check mount"

echo "✅ Migration completed successfully!"
echo ""
echo "📋 Post-migration checklist:"
echo "1. Verify Grafana is accessible: http://localhost:3000"
echo "2. Check that dashboards are preserved"
echo "3. Verify user accounts still exist"
echo "4. Test data source connections"
echo "5. Check alert rules are intact"
echo ""
echo "🔄 If needed, you can rollback with:"
echo "kubectl apply -f grafana-deployment-backup.yaml"
