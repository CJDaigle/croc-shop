# etcd Backup and Recovery Guide

## 🎯 Overview

This guide provides a comprehensive etcd backup and recovery solution for RKE2 Kubernetes clusters. etcd is the critical database that stores all Kubernetes cluster state, making regular backups essential for disaster recovery.

## 📋 Prerequisites

### **Cluster Requirements**
- RKE2 cluster with 3 control-plane nodes
- etcd running on control-plane nodes
- Sufficient storage for backups (recommend 10x etcd data size)
- Proper RBAC permissions for backup operations

### **Storage Requirements**
- **Local Storage**: `/var/lib/rancher/rke2/server/db/etcd-backups`
- **Recommended Size**: 100GB for typical clusters
- **Retention**: 30 days (configurable)
- **Compression**: gzip enabled by default

## 🔄 Backup Solutions

### **1. Automated Daily Backups (Recommended)**

#### **CronJob Implementation**
- **Schedule**: Daily at 2 AM UTC
- **Location**: All control-plane nodes
- **Method**: etcd snapshot with verification
- **Retention**: 30 days with automatic cleanup

#### **Setup**:
```bash
# Apply RBAC permissions
kubectl apply -f etcd-backup-rbac.yaml

# Deploy backup CronJob
kubectl apply -f etcd-backup-cronjob.yaml

# Deploy monitoring
kubectl apply -f etcd-backup-monitoring.yaml

# Verify deployment
kubectl get cronjob -n kube-system | grep etcd
```

#### **Features**:
- ✅ **Automated scheduling** via CronJob
- ✅ **Snapshot verification** for integrity
- ✅ **Metadata tracking** with cluster info
- ✅ **Compression** for storage efficiency
- ✅ **Automatic cleanup** of old backups
- ✅ **Health monitoring** with Prometheus metrics

### **2. Manual Backup Script**

#### **Script Usage**:
```bash
# Copy script to control-plane nodes
scp etcd-backup-script.sh root@node:/tmp/

# Execute backup
ssh root@node "chmod +x /tmp/etcd-backup-script.sh && /tmp/etcd-backup-script.sh"

# Verify backup
ls -la /var/lib/rancher/rke2/server/db/etcd-backups/
```

#### **Script Features**:
- ✅ **Root permission check**
- ✅ **RKE2 service validation**
- ✅ **etcd connectivity test**
- ✅ **Snapshot creation and verification**
- ✅ **Metadata generation**
- ✅ **Compression and cleanup**

### **3. Kubernetes-Native Backup**

#### **Advantages**:
- **Cluster-managed**: No SSH access required
- **Scheduling**: Native CronJob support
- **Monitoring**: Integrated with Prometheus
- **Security**: RBAC-controlled access
- **Logging**: Structured logging with events

## 📊 Backup Components

### **Backup Files**
```
/var/lib/rancher/rke2/server/db/etcd-backups/
├── etcd-backup-20240304-020000.db.gz
├── etcd-backup-20240304-020000-metadata.json.gz
├── etcd-backup-20240303-020000.db.gz
├── etcd-backup-20240303-020000-metadata.json.gz
└── ...
```

### **Metadata Format**
```json
{
  "backup_name": "etcd-backup-20240304-020000",
  "timestamp": "20240304-020000",
  "created_at": "2024-03-04T02:00:00+00:00",
  "etcd_version": "v3.5.9",
  "node_hostname": "ip-10-0-1-60",
  "node_ip": "10.0.1.60",
  "kubernetes_version": "v1.31.12+rke2r1",
  "snapshot_size": 52428800,
  "snapshot_checksum": "sha256hash...",
  "backup_script_version": "1.0",
  "cluster_name": "cilium-ai-defense"
}
```

## 🔍 Monitoring and Alerting

### **Prometheus Metrics**
- `etcd_backup_successful_count` - Number of successful backups
- `etcd_backup_last_success_timestamp` - Last backup timestamp
- `etcd_backup_age_seconds` - Age of last backup
- `etcd_backup_recent_failures` - Today's failure count
- `etcd_backup_total_size_bytes` - Total backup storage
- `etcd_backup_latest_size_bytes` - Latest backup size
- `etcd_backup_health` - Overall health status

### **Grafana Dashboard**
- **File**: `etcd-backup-monitoring.json`
- **Panels**: 4 monitoring panels
- **Refresh**: 1 minute
- **Alerts**: Health status and backup age

### **Alerting Rules**
```yaml
# Example Prometheus alerting rules
groups:
- name: etcd-backup
  rules:
  - alert: etcdBackupUnhealthy
    expr: etcd_backup_health == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "etcd backup is unhealthy"
      
  - alert: etcdBackupAgeHigh
    expr: etcd_backup_age_seconds > 172800  # 48 hours
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "etcd backup is older than 48 hours"
```

## 🚨 Disaster Recovery

### **Restore Scenarios**

#### **1. Complete etcd Failure**
```bash
# On any control-plane node
./etcd-restore-script.sh etcd-backup-20240304-020000.db.gz
```

#### **2. Partial Corruption**
```bash
# Restore from latest known good backup
./etcd-restore-script.sh
```

#### **3. Cluster Migration**
```bash
# Copy backup to new cluster
scp etcd-backup-*.db.gz new-cluster:/tmp/
# Run restore on new cluster
./etcd-restore-script.sh /tmp/etcd-backup-20240304-020000.db.gz
```

### **Restore Process**
1. **Validation**: Verify backup integrity
2. **Safety**: Backup current data automatically
3. **Shutdown**: Stop RKE2 service safely
4. **Restore**: Extract and restore snapshot
5. **Verification**: Start and validate cluster
6. **Confirmation**: Verify Kubernetes functionality

### **Restore Safety Features**
- ✅ **Automatic backup** of current data
- ✅ **Integrity verification** before restore
- ✅ **Service management** (stop/start RKE2)
- ✅ **Health checks** post-restore
- ✅ **Rollback capability** if restore fails

## 🛠 Advanced Configuration

### **Custom Backup Schedule**
```yaml
# Edit etcd-backup-cronjob.yaml
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  # schedule: "0 2 * * 1"  # Weekly on Monday
  # schedule: "0 2 1 * *"  # Monthly on 1st
```

### **External Storage Integration**
```bash
# Add to backup script for S3
if command -v aws >/dev/null 2>&1; then
  backup_log "Copying backup to S3..."
  aws s3 cp "$BACKUP_DIR/$BACKUP_NAME.db.gz" "s3://your-backup-bucket/etcd-backups/"
  aws s3 cp "$BACKUP_DIR/$BACKUP_NAME-metadata.json.gz" "s3://your-backup-bucket/etcd-backups/"
  backup_log "Backup copied to S3 successfully"
fi

# For Azure Blob Storage
if command -v az >/dev/null 2>&1; then
  az storage blob upload --container-name etcd-backups \
    --file "$BACKUP_DIR/$BACKUP_NAME.db.gz" \
    --name "$BACKUP_NAME.db.gz"
fi
```

### **Email Notifications**
```bash
# Add to backup script
if command -v mail >/dev/null 2>&1; then
  echo "etcd backup completed: $BACKUP_NAME" | \
    mail -s "etcd Backup Success" admin@yourcompany.com
fi
```

## 🔧 Troubleshooting

### **Common Issues**

#### **1. Permission Denied**
```bash
# Ensure script runs as root
sudo ./etcd-backup-script.sh
```

#### **2. etcd Connection Failed**
```bash
# Check etcd service
systemctl status rke2-server

# Check etcd health
ETCDCTL_API=3 etcdctl --cacert=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt \
  --cert=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt \
  --key=/var/lib/rancher/rke2/server/tls/etcd/server-ca.key \
  --endpoints=https://127.0.0.1:2379 endpoint health
```

#### **3. Storage Full**
```bash
# Check disk usage
df -h /var/lib/rancher/rke2/server/db/etcd-backups

# Manual cleanup older backups
find /var/lib/rancher/rke2/server/db/etcd-backups -name "*.gz" -mtime +7 -delete
```

#### **4. CronJob Not Running**
```bash
# Check CronJob status
kubectl get cronjob -n kube-system etcd-backup

# Check job history
kubectl get jobs -n kube-system | grep etcd-backup

# Check job logs
kubectl logs job/etcd-backup-<timestamp> -n kube-system
```

### **Debug Commands**

```bash
# List all backups
ls -la /var/lib/rancher/rke2/server/db/etcd-backups/

# Check backup integrity
gunzip -c etcd-backup-20240304-020000.db.gz | \
  ETCDCTL_API=3 etcdctl snapshot status --write-out=table

# Verify etcd data
ETCDCTL_API=3 etcdctl --cacert=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt \
  --cert=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt \
  --key=/var/lib/rancher/rke2/server/tls/etcd/server-ca.key \
  --endpoints=https://127.0.0.1:2379 endpoint health

# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces
```

## 📚 Best Practices

### **Backup Strategy**
- **Frequency**: Daily for production, hourly for critical
- **Retention**: 30 days local, 90 days external
- **Verification**: Weekly restore testing
- **Monitoring**: Real-time health checks
- **Documentation**: Maintain runbooks

### **Security Considerations**
- **Access Control**: Limit backup access to admins
- **Encryption**: Encrypt external storage
- **Audit Logging**: Track all backup/restore operations
- **Network Security**: Secure backup transfer
- **Key Management**: Protect encryption keys

### **Performance Optimization**
- **Compression**: Use gzip for storage efficiency
- **Parallel Operations**: Backup from one node only
- **Resource Limits**: Set appropriate CPU/memory limits
- **Storage Performance**: Use fast storage for backups
- **Network Bandwidth**: Consider WAN limitations

### **Testing and Validation**
- **Monthly Restore Tests**: Verify backup integrity
- **Documentation Updates**: Keep procedures current
- **Team Training**: Ensure team familiarity
- **Disaster Drills**: Practice emergency procedures
- **Performance Testing**: Validate restore timeframes

## 🔄 Maintenance

### **Regular Tasks**
- **Monitor backup success rates**
- **Check storage capacity**
- **Review retention policies**
- **Update backup scripts**
- **Validate monitoring alerts**

### **Performance Monitoring**
- **Backup duration**: Track completion time
- **Storage growth**: Monitor backup size trends
- **Restore performance**: Test restore speed
- **Resource usage**: Monitor CPU/memory impact

## 📞 Support

### **Emergency Contacts**
- **Primary**: Kubernetes Administrator
- **Secondary**: Infrastructure Team
- **Escalation**: Management Team

### **Documentation Links**
- [RKE2 Documentation](https://docs.rke2.io/)
- [etcd Documentation](https://etcd.io/docs/)
- [Kubernetes Disaster Recovery](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)

---

**⚠️ Critical Reminder**: Regularly test your restore procedures! A backup is only as good as your ability to restore from it.
