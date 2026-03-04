# Tetragon Security Monitoring Setup

## 🎯 Overview

Isovalent Tetragon provides real-time security observability for Kubernetes clusters using eBPF. This setup includes:

- **Deep system visibility** with kernel-level monitoring
- **Network security monitoring** for all cluster traffic
- **Process execution tracking** for threat detection
- **File system monitoring** for security events
- **Prometheus integration** for metrics collection
- **Grafana dashboards** for security observability

## 📦 Installation

### Prerequisites
- Kubernetes cluster with Cilium 1.18.6+
- Helm 3.x
- Prometheus and Grafana already deployed

### Installation Steps

1. **Add Tetragon Helm Repository**
   ```bash
   helm repo add isovalent https://helm.isovalent.com/
   helm repo update
   ```

2. **Install Tetragon**
   ```bash
   helm install tetragon isovalent/tetragon -n kube-system -f tetragon-values.yaml
   ```

3. **Verify Installation**
   ```bash
   kubectl get pods -n kube-system | grep tetragon
   kubectl get svc -n kube-system | grep tetragon
   ```

## 🔧 Configuration

### Values File Configuration

The `tetragon-values.yaml` includes:

- **Agent Configuration**: Deployed on all nodes with host privileges
- **Security Context**: Privileged mode for system visibility
- **Monitoring Features**: Kernel probes, process monitoring, network monitoring
- **Prometheus Integration**: Metrics enabled on port 2112
- **Resource Limits**: CPU and memory constraints

### Network Policies

Updated Prometheus network policy to allow egress to:
- `kube-system` namespace (for Tetragon metrics)
- All croc-shop namespaces
- `sock-shop` namespace

## 📊 Monitoring Policies

### Global Network Monitoring
- **File**: `network-monitoring.yaml`
- **Scope**: Cluster-wide network and process monitoring
- **Events**: TCP/UDP connections, process execution

### Croc-Shop Specific Monitoring
- **File**: `croc-shop-monitoring.yaml`
- **Scope**: All croc-shop namespaces
- **Namespaces**: user, cart, order, product-catalog, chatbot, frontend
- **Type**: Namespaced policies for focused monitoring

## 📈 Metrics Available

### Core Metrics
- `tetragon_events_total` - Total security events
- `tetragon_errors_total` - Error count
- `tetragon_file_events_total` - File system events
- `tetragon_file_exec_events_total` - Process execution events

### Performance Metrics
- `tetragon_tracingpolicy_kernel_memory_bytes` - Kernel memory usage
- `tetragon_process_cache_size` - Process cache entries
- `tetragon_data_cache_size` - Data cache entries

### Event Processing
- `tetragon_observer_ringbuf_events_received_total` - Events received
- `tetragon_observer_ringbuf_events_lost_total` - Events lost
- `tetragon_export_ratelimit_events_dropped_total` - Rate limited events

## 🎨 Grafana Dashboards

### 1. Tetragon Security Dashboard
- **File**: `tetragon-security.json`
- **Panels**: 8 comprehensive monitoring panels
- **Coverage**: Health, events, errors, memory, cache, files, processing, policies

### 2. Tetragon Network Security Dashboard
- **File**: `tetragon-network-security.json`
- **Panels**: 4 focused security panels
- **Coverage**: Event rates, loss monitoring, cache issues, error analysis

## 🔍 Security Use Cases

### Network Monitoring
- **TCP/UDP Connections**: Track all network connections
- **Process Execution**: Monitor process creation and execution
- **File System**: Track file access and modifications

### Threat Detection
- **Unusual Network Activity**: Detect suspicious connections
- **Process Injection**: Monitor for process manipulation
- **File System Anomalies**: Detect unusual file access patterns

### Compliance Monitoring
- **Audit Trail**: Complete system activity logging
- **Policy Enforcement**: Ensure security policies are followed
- **Incident Response**: Detailed forensic data for investigations

## 🚨 Alerting Recommendations

### High Priority Alerts
- **Event Loss Rate**: > 1% events lost
- **Error Rate**: > 10 errors/minute
- **Memory Usage**: > 80% kernel memory used

### Medium Priority Alerts
- **Cache Miss Rate**: > 50% cache misses
- **Policy Failures**: Policy loading errors
- **Event Processing Delays**: High handling latency

## 🛠 Troubleshooting

### Common Issues

1. **Tetragon Pods Not Starting**
   - Check kernel version compatibility
   - Verify privileged mode is enabled
   - Check for resource constraints

2. **No Metrics in Prometheus**
   - Verify service annotations
   - Check network policies
   - Validate Prometheus configuration

3. **High Event Loss**
   - Increase rate limits
   - Check system resources
   - Optimize monitoring policies

### Debug Commands

```bash
# Check Tetragon status
kubectl get pods -n kube-system -l app=tetragon

# Check metrics endpoint
kubectl port-forward svc/tetragon 2112:2112 -n kube-system
curl http://localhost:2112/metrics

# Check policies
kubectl get tracingpolicies -A
kubectl get tracingpoliciesnamespaced -A

# View logs
kubectl logs -n kube-system -l app=tetragon
```

## 📚 Additional Resources

- [Tetragon Documentation](https://docs.cilium.io/en/stable/tetragon/)
- [eBPF Security Monitoring](https://isovalent.com/blog/tags/tetragon/)
- [Cilium Security](https://cilium.io/use-cases/security/)

## 🔄 Maintenance

### Regular Tasks
- Monitor resource usage and adjust limits
- Review and update monitoring policies
- Check for new Tetragon releases
- Validate alert configurations

### Performance Tuning
- Adjust cache sizes based on workload
- Optimize policy scope for better performance
- Monitor kernel memory usage
- Tune rate limits for event processing
