# Pod Refresh Scheduling Guide

## 🎯 Overview

This guide provides multiple approaches for scheduling pod refreshes in your Kubernetes cluster, ensuring optimal performance and reliability of your Croc-Shop and Sock-Shop services.

## 📋 Available Methods

### 1. Automated Daily Refresh (Recommended)

#### **CronJob Implementation**
- **File**: `pod-refresh-cronjob.yaml`
- **Schedule**: Daily at 2 AM UTC
- **Scope**: All croc-shop and sock-shop services
- **Features**: 
  - Automatic rolling restarts
  - Health checks and validation
  - Error handling and logging
  - Rollback on failure

#### **Setup**:
```bash
# Apply RBAC permissions
kubectl apply -f pod-refresh-rbac.yaml

# Deploy the CronJob
kubectl apply -f pod-refresh-cronjob.yaml

# Verify deployment
kubectl get cronjob -n monitoring
```

### 2. Manual Refresh Script

#### **Interactive Script**
- **File**: `refresh-pods.sh`
- **Usage**: Flexible namespace targeting
- **Features**:
  - Selective namespace refresh
  - Progress tracking
  - Error handling
  - Timeout management

#### **Usage Examples**:
```bash
# Refresh all services
./refresh-pods.sh all

# Refresh only croc-shop services
./refresh-pods.sh croc-shop

# Refresh specific namespace
./refresh-pods.sh croc-shop-user

# Refresh sock-shop services
./refresh-pods.sh sock-shop
```

### 3. On-Demand Kubernetes Commands

#### **Single Service Refresh**:
```bash
# Restart specific deployment
kubectl rollout restart deployment/user -n croc-shop-user

# Wait for completion
kubectl rollout status deployment/user -n croc-shop-user --timeout=300s
```

#### **Namespace Refresh**:
```bash
# Restart all deployments in namespace
kubectl rollout restart deployment --all -n croc-shop-user

# Check status
kubectl rollout status deployment --all -n croc-shop-user
```

## ⚙️ Configuration Options

### **CronJob Schedule Examples**

```yaml
# Different scheduling options
spec:
  schedule: "0 2 * * *"      # Daily at 2 AM
  schedule: "0 */6 * * *"    # Every 6 hours
  schedule: "0 2 * * 1"      # Weekly on Monday at 2 AM
  schedule: "0 2 1 * *"      # Monthly on 1st at 2 AM
```

### **Refresh Strategies**

#### **Rolling Update (Recommended)**
- **Zero downtime**: Gradual pod replacement
- **Health checks**: Verify new pods before scaling down
- **Rollback capability**: Automatic rollback on failure

#### **Recreate Strategy**
- **Fastest refresh**: Terminate all pods, then create new ones
- **Brief downtime**: Service unavailable during refresh
- **Resource efficient**: No double pod allocation

```yaml
# Example deployment with recreate strategy
spec:
  strategy:
    type: Recreate
```

## 🔧 Advanced Configuration

### **Health-Based Refresh**

#### **Resource Threshold Restart**
```bash
# Monitor and restart based on resource usage
#!/bin/bash
CPU_THRESHOLD=80
MEM_THRESHOLD=85

for pod in $(kubectl get pods -n croc-shop-user -o name); do
    cpu_usage=$(kubectl top pods -n croc-shop-user --no-headers | grep $pod | awk '{print $2}' | sed 's/%//')
    mem_usage=$(kubectl top pods -n croc-shop-user --no-headers | grep $pod | awk '{print $3}' | sed 's/%//')
    
    if [ "$cpu_usage" -gt "$CPU_THRESHOLD" ] || [ "$mem_usage" -gt "$MEM_THRESHOLD" ]; then
        echo "Restarting $pod due to high resource usage"
        kubectl delete pod $pod -n croc-shop-user
    fi
done
```

### **GitOps-Based Refresh**

#### **Using Image Tag Updates**
```yaml
# Automated image tag rotation
apiVersion: batch/v1
kind: CronJob
metadata:
  name: image-refresh
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: image-updater
            image: bitnami/kubectl
            command:
            - /bin/sh
            - -c
            - |
              # Update image tags with timestamp
              TIMESTAMP=$(date +%Y%m%d-%H%M%S)
              kubectl set image deployment/user user=croc-shop/user:$TIMESTAMP -n croc-shop-user
```

## 📊 Monitoring Refresh Operations

### **Metrics to Track**
- **Rollout duration**: Time to complete refresh
- **Error rates**: Failed rollouts
- **Service availability**: Downtime during refresh
- **Resource usage**: CPU/memory during refresh

### **Grafana Dashboard Panels**
```promql
# Rollout success rate
rate(kube_deployment_status_replicas_updated_total[5m]) / rate(kube_deployment_status_replicas_total[5m])

# Average rollout duration
histogram_quantile(0.95, rate(kube_deployment_status_replicas_updated_total[5m]))

# Pod restart frequency
increase(kube_pod_container_status_restarts_total[1h])
```

## 🚨 Best Practices

### **1. Refresh Timing**
- **Off-peak hours**: Schedule during low traffic periods
- **Staggered refresh**: Don't refresh all services simultaneously
- **Health verification**: Ensure services are healthy before proceeding

### **2. Error Handling**
- **Timeout management**: Set appropriate timeouts for rollouts
- **Rollback strategy**: Automatic rollback on failure
- **Notification system**: Alert on refresh failures

### **3. Resource Management**
- **Resource limits**: Set appropriate CPU/memory limits
- **Pod disruption budgets**: Prevent service disruption
- **Readiness probes**: Ensure pods are ready before serving traffic

### **4. Security Considerations**
- **RBAC permissions**: Minimal required permissions
- **Service accounts**: Dedicated service accounts for automation
- **Audit logging**: Track all refresh operations

## 🔍 Troubleshooting

### **Common Issues**

#### **1. Rollout Timeout**
```bash
# Check rollout status
kubectl rollout status deployment/user -n croc-shop-user

# Check pod events
kubectl describe pod -n croc-shop-user -l app=user

# Force restart if stuck
kubectl rollout undo deployment/user -n croc-shop-user
```

#### **2. Resource Constraints**
```bash
# Check resource usage
kubectl top pods -n croc-shop-user

# Check resource limits
kubectl describe deployment user -n croc-shop-user
```

#### **3. Network Issues**
```bash
# Check service connectivity
kubectl get svc -n croc-shop-user

# Test pod connectivity
kubectl exec -it deployment/user -n croc-shop-user -- curl http://localhost:3002/health
```

### **Debug Commands**

```bash
# View CronJob history
kubectl get cronjob -n monitoring
kubectl describe cronjob croc-shop-daily-refresh -n monitoring

# Check job logs
kubectl get jobs -n monitoring
kubectl logs job/<job-name> -n monitoring

# Manual job execution
kubectl create job --from=cronjob/croc-shop-daily-refresh manual-refresh-$(date +%s) -n monitoring
```

## 📚 Additional Resources

- [Kubernetes Rollouts](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-updates)
- [CronJob Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [Pod Disruption Budgets](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)

## 🔄 Maintenance

### **Regular Tasks**
- **Review refresh schedules**: Adjust based on usage patterns
- **Monitor performance**: Track refresh success rates
- **Update scripts**: Keep automation scripts current
- **Backup configurations**: Version control all automation

### **Optimization Tips**
- **Parallel processing**: Refresh independent services simultaneously
- **Health checks**: Add comprehensive health verification
- **Notification integration**: Slack/Teams notifications for failures
- **Performance tuning**: Optimize for your specific workload
