#!/bin/bash

set -e

echo "Deploying monitoring stack..."

# Ensure monitoring namespace exists
echo "Ensuring monitoring namespace exists..."
kubectl apply -f k8s/base/namespaces.yaml

# Deploy Prometheus
echo "Deploying Prometheus..."
kubectl apply -f k8s/monitoring/prometheus.yaml

# Deploy Grafana
echo "Deploying Grafana..."
kubectl apply -f k8s/monitoring/grafana.yaml

# Wait for monitoring services
echo "Waiting for monitoring services to be ready..."
kubectl wait --for=condition=ready pod -l app=prometheus -n crock-shop-monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=grafana -n crock-shop-monitoring --timeout=300s

echo ""
echo "Monitoring stack deployed successfully!"
echo ""
echo "Monitoring namespace: crock-shop-monitoring"
echo "Scraping metrics from all crock-shop namespaces"
echo ""
echo "Access dashboards:"
echo "  Prometheus: kubectl port-forward -n crock-shop-monitoring svc/prometheus 9090:9090"
echo "  Grafana: kubectl port-forward -n crock-shop-monitoring svc/grafana 3000:3000"
echo ""
echo "Grafana default credentials: admin/admin"
echo ""
echo "Check Prometheus targets:"
echo "  Open http://localhost:9090/targets after port-forwarding"
