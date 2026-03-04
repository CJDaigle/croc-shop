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

### ⚠️ KNOWN ISSUES WITH CILUM GATEWAY API

**Important**: There are known issues with Cilium Gateway API when exposing monitoring services. See the "Known Issues" section below for details.

### Step 7: Create TLS Certificate for Prometheus

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: prometheus-tls
  namespace: default
spec:
  secretName: prometheus-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - prometheus.apo-llm-test.com
```

```bash
kubectl apply -f prometheus-gateway-cert.yaml
```

### Step 8: Add HTTPS Listener to Gateway

```yaml
spec:
  listeners:
    # ... existing listeners ...
    - name: https-prometheus
      protocol: HTTPS
      port: 443
      hostname: prometheus.apo-llm-test.com
      tls:
        mode: Terminate
        certificateRefs:
          - name: prometheus-tls
            namespace: default
      allowedRoutes:
        namespaces:
          from: All
```

```bash
kubectl patch gateway cilium-gateway-application-gateway -n default --patch-file=gateway-patch-prometheus.yaml --type=merge
```

### Step 9: Create HTTPRoute for Prometheus

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: prometheus-route
  namespace: monitoring
spec:
  parentRefs:
    - name: cilium-gateway-application-gateway
      namespace: default
      sectionName: https-prometheus
  hostnames:
    - "prometheus.apo-llm-test.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: prometheus
          namespace: monitoring
          port: 9090
```

```bash
kubectl apply -f prometheus-gateway-route.yaml
```

### Step 10: Test External Access

```bash
# Check certificate status
kubectl get certificate prometheus-tls -o wide

# Test external access
curl -sS -m 10 -o /dev/null -w "prometheus: %{http_code}\n" https://prometheus.apo-llm-test.com/
```

## Grafana Deployment

### Step 11: Create Grafana Datasources ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      access: proxy
      url: http://prometheus.monitoring.svc.cluster.local:9090
      isDefault: true
```

```bash
kubectl apply -f grafana-datasources.yaml
```

### Step 12: Create Grafana Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
  labels:
    app: grafana
spec:
  type: ClusterIP
  ports:
  - name: web
    port: 3000
    targetPort: 3000
    protocol: TCP
  selector:
    app: grafana
```

```bash
kubectl apply -f grafana-service.yaml
```

### Step 13: Create Grafana Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
  labels:
    app: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin
        - name: GF_SECURITY_ADMIN_USER
          value: admin
        - name: GF_SERVER_ROOT_URL
          value: '%(protocol)s://%(domain)s/'
        - name: GF_SERVER_SERVE_FROM_SUB_PATH
          value: "false"
        ports:
        - containerPort: 3000
          name: web
          protocol: TCP
        resources:
          limits:
            cpu: 200m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 256Mi
        volumeMounts:
        - name: datasources
          mountPath: /etc/grafana/provisioning/datasources
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: datasources
        configMap:
          name: grafana-datasources
```

```bash
kubectl apply -f grafana-deployment.yaml
```

### Step 14: Create Grafana NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grafana-policy
  namespace: monitoring
spec:
  podSelector:
    matchLabels:
      app: grafana
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
      port: 3000
  # Allow from same namespace
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
  # Allow from all namespaces (for external access)
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 3000
  egress:
  # Allow DNS
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  # Allow all egress for Prometheus access
  - to: []
    ports:
    - protocol: TCP
    - protocol: UDP
```

```bash
kubectl apply -f grafana-networkpolicy.yaml
```

### Step 15: Add Grafana to Gateway API

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: grafana-tls
  namespace: default
spec:
  secretName: grafana-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - grafana.apo-llm-test.com
```

```bash
kubectl apply -f grafana-gateway-cert.yaml
```

Add HTTPS listener to Gateway (similar to Prometheus):
```yaml
- name: https-grafana
  protocol: HTTPS
  port: 443
  hostname: grafana.apo-llm-test.com
  tls:
    mode: Terminate
    certificateRefs:
      - name: grafana-tls
        namespace: default
  allowedRoutes:
    namespaces:
      from: All
```

Create Grafana HTTPRoute:
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: grafana-route
  namespace: monitoring
spec:
  parentRefs:
    - name: cilium-gateway-application-gateway
      namespace: default
      sectionName: https-grafana
  hostnames:
    - "grafana.apo-llm-test.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: grafana
          namespace: monitoring
          port: 3000
```

## Alternative Access Methods (Workarounds)

### NodePort Access

**Note**: NodePort also has issues with Cilium on gateway nodes.

```bash
# Change service type to NodePort
kubectl patch svc prometheus -n monitoring -p '{"spec":{"type":"NodePort"}}'
kubectl patch svc grafana -n monitoring -p '{"spec":{"type":"NodePort"}}'

# Get assigned ports
kubectl get svc -n monitoring

# Test access (will likely timeout due to Cilium issues)
curl http://10.0.1.112:<NODEPORT>/-
curl http://10.0.1.169:<NODEPORT>/-
```

### Port-Forwarding (Recommended Workaround)

```bash
# Prometheus port-forward
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
# Access: http://localhost:9090

# Grafana port-forward  
kubectl port-forward -n monitoring svc/grafana 3000:3000 &
# Access: http://localhost:3000 (admin/admin)

# Kill port-forwards when done
kill %1 %2
```

### LoadBalancer Service (If Supported)

```bash
# Change to LoadBalancer (requires cloud provider support)
kubectl patch svc prometheus -n monitoring -p '{"spec":{"type":"LoadBalancer"}}'
kubectl patch svc grafana -n monitoring -p '{"spec":{"type":"LoadBalancer"}}'

# Get external IPs
kubectl get svc -n monitoring
```

## Service Annotations

To enable metrics collection for your services, add these annotations:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"  # Your metrics port
    prometheus.io/path: "/metrics"  # Your metrics path
```

## Final Configuration (Recommended)

Due to the known Cilium Gateway API issues with monitoring services, the recommended configuration is:

### ✅ Working Setup
- **Prometheus**: ClusterIP service, internal access only
- **Grafana**: ClusterIP service, internal access only
- **Access Method**: Port-forwarding script
- **External Access**: Not available (due to Cilium bug)

### 📁 Current Files
```bash
# Access script
./k8s/monitoring/access-monitoring.sh

# Documentation
./k8s/monitoring/MONITORING-SETUP.md
```

### 🚀 Quick Access
```bash
# Run the access script
./k8s/monitoring/access-monitoring.sh

# Or manual port-forwarding
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
kubectl port-forward -n monitoring svc/grafana 3000:3000 &
```

### 📊 URLs
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Cleanup

To remove the monitoring stack:

```bash
kubectl delete namespace monitoring
kubectl delete clusterrole prometheus
kubectl delete clusterrolebinding prometheus
```

## Known Issues with Cilium Gateway API

### ⚠️ Critical: "no healthy upstream" Bug

**Issue**: Cilium Gateway API has a known bug affecting monitoring services (Prometheus, Grafana, AlertManager) that results in 503 "no healthy upstream" errors.

**Affected Versions**: Cilium 1.15.x, 1.16.x, 1.17.x, 1.18.x (including our 1.18.6)

**GitHub Issues**:
- [HTTPRoute results in "no healthy upstream" on Alert Manager and Prometheus #31212](https://github.com/cilium/cilium/issues/31212)
- [No healthy upstream for kube-prometheus-stack-grafana exposed through gateway #32089](https://github.com/cilium/cilium/issues/32089)
- [HTTPRoute fails with 'no healthy upstream' with externalTrafficPolicy #41482](https://github.com/cilium/cilium/issues/41482)

**Symptoms**:
- Gateway API returns 503 Service Unavailable
- Error message: "no healthy upstream"
- Internal cluster access works fine (HTTP 200)
- NodePort also fails (connection timeouts)
- Only affects monitoring services, other services work correctly

**Root Cause**: Bug in Cilium's logic for handling monitoring services through Gateway API.

**Current Status**: Open issues, no confirmed fixes available.

**Workarounds**:
1. **Port-forwarding** (recommended for admin access)
2. **LoadBalancer services** (if cloud provider supports)
3. **Alternative ingress controllers** (nginx, Traefik)
4. **Wait for Cilium fix** and monitor GitHub issues

### NodePort Issues

**Additional Issue**: NodePort services also fail on gateway nodes with connection timeouts, suggesting broader networking issues with Cilium's hostNetwork mode.

**Test Results**:
```bash
# Both services work internally
curl http://prometheus.monitoring.svc.cluster.local:9090/-/healthy  # 200 OK
curl http://grafana.monitoring.svc.cluster.local:3000/api/health      # 200 OK

# Both fail via NodePort
curl http://10.0.1.112:31150/-/healthy  # Connection timeout
curl http://10.0.1.169:31150/-/healthy  # Connection timeout
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
- **Expected**: 503 "no healthy upstream" (known Cilium bug)
- Check NetworkPolicy allows gateway node IPs
- Verify HTTPRoute configuration
- Check TLS certificate status
- **Use port-forwarding workaround instead**

### NodePort Not Working
- **Expected**: Connection timeouts (known Cilium issue)
- Verify service type is NodePort
- Check assigned ports
- **Use port-forwarding workaround instead**

### Port-Forwarding Issues
```bash
# Check if services are running
kubectl get pods -n monitoring

# Check service endpoints
kubectl get endpoints -n monitoring

# Test internal connectivity
kubectl run test-pod --image=curlimages/curl --rm -it --restart=Never -- \
  curl -s http://prometheus.monitoring.svc.cluster.local:9090/-/healthy
```

### Grafana Cannot Connect to Prometheus
- Check Grafana datasource configuration
- Verify Prometheus service is accessible from Grafana pod
- Check NetworkPolicy allows Grafana → Prometheus traffic
- Verify Prometheus is healthy and scraping targets
