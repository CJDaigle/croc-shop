#!/bin/bash

# Monitoring Access Script
# Provides easy port-forwarding access to Prometheus and Grafana

set -e

NAMESPACE="monitoring"
PROMETHEUS_PORT="9090"
GRAFANA_PORT="3000"

echo "🔍 Monitoring Access Script"
echo "=========================="

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
    echo "❌ Namespace '$NAMESPACE' not found"
    exit 1
fi

# Check if services exist
if ! kubectl get svc prometheus -n $NAMESPACE >/dev/null 2>&1; then
    echo "❌ Prometheus service not found"
    exit 1
fi

if ! kubectl get svc grafana -n $NAMESPACE >/dev/null 2>&1; then
    echo "❌ Grafana service not found"
    exit 1
fi

# Check if pods are running
PROMETHEUS_READY=$(kubectl get pods -n $NAMESPACE -l app=prometheus -o jsonpath='{.items[0].status.containerStatuses[0].ready}')
GRAFANA_READY=$(kubectl get pods -n $NAMESPACE -l app=grafana -o jsonpath='{.items[0].status.containerStatuses[0].ready}')

if [ "$PROMETHEUS_READY" != "true" ]; then
    echo "❌ Prometheus pod is not ready"
    exit 1
fi

if [ "$GRAFANA_READY" != "true" ]; then
    echo "❌ Grafana pod is not ready"
    exit 1
fi

echo "✅ All services are ready"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping port-forwarding..."
    jobs -p | xargs -r kill
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "🚀 Starting port-forwarding..."
echo ""

# Start Prometheus port-forward
echo "📊 Prometheus: http://localhost:$PROMETHEUS_PORT"
kubectl port-forward -n $NAMESPACE svc/prometheus $PROMETHEUS_PORT:9090 &
PROM_PID=$!

# Start Grafana port-forward
echo "📈 Grafana: http://localhost:$GRAFANA_PORT (admin/admin)"
kubectl port-forward -n $NAMESPACE svc/grafana $GRAFANA_PORT:3000 &
GRAF_PID=$!

echo ""
echo "⏳ Port-forwarding active. Press Ctrl+C to stop."
echo ""

# Wait for background processes
wait
