# Temporary Fix: Port-Forwarding Monitoring Services

## Overview

Due to the Cilium Gateway API bug affecting monitoring services (503 "no healthy upstream" errors), we need to use port-forwarding to access Prometheus and Grafana from the local machine.

## Quick Start

### Option 1: Use the Access Script (Recommended)

```bash
# Navigate to the monitoring directory
cd k8s/monitoring/

# Run the automated access script
./access-monitoring.sh
```

This will:
- Check if services are ready
- Start port-forwarding for both services
- Display the URLs
- Handle cleanup automatically when you press Ctrl+C

### Option 2: Manual Port-Forwarding

```bash
# Set up environment variables
export NAMESPACE=monitoring
export PROMETHEUS_LOCAL_PORT=9090
export GRAFANA_LOCAL_PORT=3000

# Start Prometheus port-forward (background)
kubectl port-forward -n $NAMESPACE svc/prometheus $PROMETHEUS_LOCAL_PORT:9090 &
PROM_PID=$!

# Start Grafana port-forward (background)
kubectl port-forward -n $NAMESPACE svc/grafana $GRAFANA_LOCAL_PORT:3000 &
GRAF_PID=$!

# Display access information
echo "🔍 Monitoring Services Access"
echo "=============================="
echo "Prometheus: http://localhost:$PROMETHEUS_LOCAL_PORT"
echo "Grafana:    http://localhost:$GRAFANA_LOCAL_PORT (admin/admin)"
echo ""
echo "Press Ctrl+C to stop port-forwarding"

# Wait for user to stop
trap "echo 'Stopping port-forwarding...'; kill $PROM_PID $GRAF_PID 2>/dev/null; exit" INT
wait
```

## Access URLs

| Service | Local URL | Credentials |
|---------|-----------|-------------|
| **Prometheus** | http://localhost:9090 | None (public) |
| **Grafana** | http://localhost:3000 | admin/admin |

## Verification

### Check Services Status

```bash
# Check if pods are running
kubectl get pods -n monitoring

# Check service endpoints
kubectl get endpoints -n monitoring

# Test internal connectivity
kubectl run test-pod --image=curlimages/curl --rm -it --restart=Never -- \
  curl -s -o /dev/null -w "Prometheus: %{http_code}\n" \
  http://prometheus.monitoring.svc.cluster.local:9090/-/healthy && \
  curl -s -o /dev/null -w "Grafana: %{http_code}\n" \
  http://grafana.monitoring.svc.cluster.local:3000/api/health
```

Expected output:
```
Prometheus: 200
Grafana: 200
```

### Test Local Access

```bash
# Test Prometheus locally
curl -s -o /dev/null -w "Prometheus local: %{http_code}\n" http://localhost:9090/-/healthy

# Test Grafana locally
curl -s -o /dev/null -w "Grafana local: %{http_code}\n" http://localhost:3000/api/health
```

Expected output:
```
Prometheus local: 200
Grafana local: 200
```

## Port-Forwarding Details

### What Port-Forwarding Does

Port-forwarding creates a secure tunnel from your local machine to the Kubernetes cluster:

```
Local Machine (localhost:9090) → Kubernetes API Server → Prometheus Pod (10.43.197.63:9090)
Local Machine (localhost:3000) → Kubernetes API Server → Grafana Pod (10.43.30.33:3000)
```

### Port Mappings

| Local Port | Service | Cluster Port | Target Port |
|------------|---------|--------------|-------------|
| 9090 | Prometheus | 9090 | 9090 |
| 3000 | Grafana | 3000 | 3000 |

### Service Details

```bash
# Prometheus service
kubectl get svc prometheus -n monitoring -o wide
# NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
# prometheus   ClusterIP   10.43.197.63   <none>        9090/TCP   20m

# Grafana service
kubectl get svc grafana -n monitoring -o wide
# NAME      TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
# grafana   ClusterIP   10.43.30.33   <none>        3000/TCP   8m
```

## Troubleshooting

### Port Already in Use

```bash
# Check if ports are already in use
lsof -i :9090
lsof -i :3000

# Kill existing processes if needed
kill -9 $(lsof -t -i:9090)
kill -9 $(lsof -t -i:3000)
```

### Connection Refused

```bash
# Check if services are running
kubectl get pods -n monitoring

# Check pod logs
kubectl logs -n monitoring -l app=prometheus
kubectl logs -n monitoring -l app=grafana

# Restart port-forwarding
# Stop existing processes first
pkill -f "port-forward.*prometheus"
pkill -f "port-forward.*grafana"

# Start again
./access-monitoring.sh
```

### Permission Issues

```bash
# Make sure the access script is executable
chmod +x k8s/monitoring/access-monitoring.sh

# Check kubectl context
kubectl config current-context
kubectl cluster-info
```

## Advanced Usage

### Different Local Ports

If you need different local ports (to avoid conflicts):

```bash
# Use different local ports
kubectl port-forward -n monitoring svc/prometheus 19090:9090 &
kubectl port-forward -n monitoring svc/grafana 13000:3000 &

# Access at:
# Prometheus: http://localhost:19090
# Grafana: http://localhost:13000
```

### Background Service

Create a systemd service for persistent access (Linux/macOS):

```bash
# Create service file
cat > ~/monitoring-port-forward.service << 'EOF'
[Unit]
Description=Monitoring Port Forward
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/bin/bash -c 'cd /path/to/croc-shop && ./k8s/monitoring/access-monitoring.sh'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable --now ~/monitoring-port-forward.service
```

### One-Liner Access

Quick access without scripts:

```bash
# Prometheus only
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &

# Grafana only  
kubectl port-forward -n monitoring svc/grafana 3000:3000 &

# Both at once
kubectl port-forward -n monitoring svc/prometheus 9090:9090 & kubectl port-forward -n monitoring svc/grafana 3000:3000 &
```

## Security Notes

- Port-forwarding uses the Kubernetes API server for authentication
- Connections are encrypted and secure
- Only accessible from your local machine
- No external exposure (unlike NodePort or LoadBalancer)
- Requires kubectl access to the cluster

## Cleanup

```bash
# Stop all port-forwarding processes
pkill -f "port-forward.*monitoring"

# Or use the script's cleanup (Ctrl+C)
# The access script handles cleanup automatically

# Verify no processes are running
ps aux | grep "port-forward" | grep monitoring
```

## Next Steps

When the Cilium Gateway API bug is fixed, you can:

1. Remove port-forwarding setup
2. Follow the Gateway API integration steps in `MONITORING-SETUP.md`
3. Access services via HTTPS URLs:
   - https://prometheus.apo-llm-test.com
   - https://grafana.apo-llm-test.com

Monitor the GitHub issues for updates:
- [Cilium Issue #31212](https://github.com/cilium/cilium/issues/31212)
- [Cilium Issue #32089](https://github.com/cilium/cilium/issues/32089)
