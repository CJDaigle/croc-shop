# Monitoring Setup Guide

This guide explains how to set up Prometheus and Grafana monitoring with cluster-wide service discovery in the croc-shop cluster.

## Overview

The monitoring stack consists of:
- **Prometheus**: Metrics collection and storage with cluster-wide service discovery
- **Grafana**: Visualization and dashboarding
- **Gateway API**: External HTTPS access to monitoring services

## Architecture

```
Internet → Cilium Gateway API → Prometheus/Grafana Services
                                      │
                              Cluster-wide Service Discovery
                                      │
                              All Kubernetes Services/Pods
```

## Prerequisites

- Kubernetes cluster with Cilium Gateway API
- cert-manager with Let's Encrypt ClusterIssuer
- `monitoring` namespace created

## Prometheus Deployment

### Step 1: Create Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    name: monitoring
    app: monitoring
```

```bash
kubectl apply -f monitoring-namespace.yaml
```

### Step 2: Create ServiceAccount and RBAC

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- apiGroups:
  - extensions
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
```

```bash
kubectl apply -f prometheus-rbac.yaml
```

### Step 3: Create Prometheus Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - "alert_rules.yml"

    alerting:
      alertmanagers:
        - static_configs:
            - targets: []

    scrape_configs:
    # Prometheus itself
    - job_name: 'prometheus'
      static_configs:
        - targets: ['localhost:9090']

    # Kubernetes API Server
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

    # All pods with prometheus annotations
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name

    # All services with prometheus annotations
    - job_name: 'kubernetes-services'
      kubernetes_sd_configs:
      - role: service
      relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scheme]
        action: replace
        target_label: __scheme__
        regex: (https?)
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
      - action: labelmap
        regex: __meta_kubernetes_service_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        action: replace
        target_label: kubernetes_name

  alert_rules.yml: |
    groups:
    - name: example_alerts
      rules:
      - alert: PrometheusTargetDown
        expr: up == 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Prometheus target is down"
          description: "Prometheus target {{ $labels.instance }} is down for more than 1 minute."
```

```bash
kubectl apply -f prometheus-config.yaml
```

### Step 4: Create Prometheus Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
  labels:
    app: prometheus
spec:
  type: ClusterIP
  ports:
  - name: web
    port: 9090
    targetPort: 9090
    protocol: TCP
  selector:
    app: prometheus
```

```bash
kubectl apply -f prometheus-service.yaml
```

### Step 5: Create Prometheus Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
  labels:
    app: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        args:
          - '--config.file=/etc/prometheus/prometheus.yml'
          - '--storage.tsdb.path=/prometheus'
          - '--web.console.libraries=/etc/prometheus/console_libraries'
          - '--web.console.templates=/etc/prometheus/consoles'
          - '--storage.tsdb.retention.time=15d'
          - '--web.enable-lifecycle'
        ports:
        - containerPort: 9090
          name: web
          protocol: TCP
        resources:
          limits:
            cpu: 500m
            memory: 1Gi
          requests:
            cpu: 250m
            memory: 512Mi
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: storage
          mountPath: /prometheus
        livenessProbe:
          httpGet:
            path: /-/healthy
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /-/ready
            port: 9090
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: prometheus-config
      - name: storage
        emptyDir: {}
```

```bash
kubectl apply -f prometheus-deployment.yaml
```

### Step 6: Create NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prometheus-policy
  namespace: monitoring
spec:
  podSelector:
    matchLabels:
      app: prometheus
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Allow from gateway nodes (10.0.0.0/16)
  - from:
    - ipBlock:
        cidr: 10.0.0.0/16
    ports:
    - protocol: TCP
      port: 9090
  # Allow from same namespace
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090
  # Allow from all namespaces (for Grafana and other services)
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 9090
  egress:
  # Allow DNS
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  # Allow all egress for service discovery
  - to: []
    ports:
    - protocol: TCP
    - protocol: UDP
```

```bash
kubectl apply -f prometheus-networkpolicy.yaml
```

## Verification

### Check Prometheus Status

```bash
# Check pod status
kubectl get pods -n monitoring

# Check service status
kubectl get svc -n monitoring

# Check logs
kubectl logs -n monitoring -l app=prometheus

# Test health endpoint
kubectl exec -n monitoring -l app=prometheus -- wget -q -O - http://localhost:9090/-/healthy
```

### Check Service Discovery

```bash
# Port-forward to test locally
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Access Prometheus UI
# Open http://localhost:9090 in browser

# Check targets
# Navigate to Status > Targets in Prometheus UI
```

## Gateway API Integration

To add Prometheus to the Gateway API:

1. Create TLS certificate
2. Add HTTPS listener to Gateway
3. Create HTTPRoute
4. Test external access

(See Gateway API documentation for detailed steps)

## Service Annotations

To enable metrics collection for your services, add these annotations:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"  # Your metrics port
    prometheus.io/path: "/metrics"  # Your metrics path
```

## Cleanup

To remove the monitoring stack:

```bash
kubectl delete namespace monitoring
kubectl delete clusterrole prometheus
kubectl delete clusterrolebinding prometheus
```

## Troubleshooting

### Prometheus Not Starting
- Check RBAC permissions
- Verify ConfigMap syntax
- Check resource limits

### Service Discovery Not Working
- Verify ServiceAccount has proper permissions
- Check NetworkPolicy rules
- Verify annotations on target services

### Gateway Access Issues
- Check NetworkPolicy allows gateway node IPs
- Verify HTTPRoute configuration
- Check TLS certificate status
