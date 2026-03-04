# Grafana Persistence Guide

## 🎯 Overview

This guide explains why and how to configure persistent storage for Grafana in your Kubernetes cluster. Persistent storage ensures that your Grafana configuration, dashboards, users, and data sources survive pod restarts and upgrades.

## ⚠️ Current Issue

### **Without Persistent Storage**
- **Ephemeral Data**: All configurations stored in emptyDir
- **Data Loss**: Everything lost on pod restart
- **Manual Re-setup**: Need to re-import dashboards and configure users
- **No Backup**: Cannot backup Grafana configuration

### **What's Lost Without PVC**
- 🗨️ **Imported Dashboards** (all your custom dashboards)
- 👥 **User Accounts** and team configurations
- 📊 **Data Sources** (Prometheus connections)
- ⚙️ **Alert Rules** and notification channels
- 🎨 **Custom Settings** and preferences
- 📈 **Dashboard Folders** and organization

## 📦 Persistent Storage Solution

### **Storage Components**
```
/var/lib/grafana/
├── grafana.db          # Main database (users, dashboards, datasources)
├── data/               # Plugin data and cache
├── dashboards/         # Dashboard definitions
├── plugins/            # Installed plugins
└── log/                # Application logs
```

### **PVC Configuration**
- **Size**: 10Gi (sufficient for most use cases)
- **StorageClass**: Longhorn (recommended for HA)
- **Access Mode**: ReadWriteOnce (single Grafana instance)
- **Backup**: Included in etcd backup strategy

## 🔄 Migration Steps

### **Automated Migration**
```bash
cd k8s/monitoring/
./migrate-grafana-pvc.sh
```

### **Manual Migration**
```bash
# 1. Create PVC
kubectl apply -f grafana-pvc.yaml

# 2. Create dashboard provisioning
kubectl apply -f grafana-dashboard-provisioning.yaml

# 3. Update deployment
kubectl apply -f grafana-with-pvc.yaml

# 4. Verify migration
kubectl rollout status deployment/grafana -n monitoring
```

## 📊 Benefits of PVC

### **Data Persistence**
- ✅ **Dashboard Survival**: Dashboards persist across restarts
- ✅ **User Preservation**: User accounts and permissions maintained
- ✅ **Configuration Retention**: All settings preserved
- ✅ **Plugin Persistence**: Installed plugins survive upgrades

### **Operational Benefits**
- ✅ **Zero-Downtime Updates**: Seamless Grafana upgrades
- ✅ **Backup Capability**: Can backup Grafana database
- ✅ **Disaster Recovery**: Quick restore from backup
- ✅ **Multi-Environment**: Consistent configurations

### **Development Benefits**
- ✅ **Dashboard Development**: Work without fear of losing changes
- ✅ **Team Collaboration**: Shared workspace persists
- ✅ **Version Control**: Can track dashboard changes
- ✅ **Testing**: Safe environment for experiments

## 🔧 Configuration Details

### **Storage Requirements**
```yaml
resources:
  requests:
    storage: 10Gi  # Adjust based on usage
```

### **Security Context**
```yaml
securityContext:
  runAsUser: 472      # Grafana user
  runAsGroup: 472     # Grafana group
  fsGroup: 472        # File system group
```

### **Volume Mounts**
```yaml
volumeMounts:
- name: grafana-storage
  mountPath: /var/lib/grafana  # Main data directory
- name: grafana-config
  mountPath: /etc/grafana/provisioning/datasources
- name: grafana-dashboards
  mountPath: /etc/grafana/provisioning/dashboards
```

## 📈 Storage Planning

### **Sizing Guidelines**
- **Small Setup**: 5Gi (1-10 users, basic dashboards)
- **Medium Setup**: 10Gi (10-50 users, moderate dashboards)
- **Large Setup**: 20Gi+ (50+ users, extensive dashboards)

### **Storage Growth Factors**
- **Dashboards**: ~1-5MB per complex dashboard
- **Users**: ~1KB per user account
- **Data Sources**: ~10KB per data source
- **Alert Rules**: ~5KB per alert rule
- **Plugins**: 10-100MB per plugin

### **Monitoring Storage Usage**
```bash
# Check current usage
kubectl exec -n monitoring deployment/grafana -- du -sh /var/lib/grafana

# Monitor growth
kubectl exec -n monitoring deployment/grafana -- df -h /var/lib/grafana
```

## 🔄 Backup Strategy

### **Database Backup**
```bash
# Backup Grafana database
kubectl exec -n monitoring deployment/grafana -- \
  cp /var/lib/grafana/grafana.db /tmp/grafana-$(date +%Y%m%d).db

# Copy backup locally
kubectl cp -n monitoring deployment/grafana:/tmp/grafana-$(date +%Y%m%d).db .
```

### **Full PVC Backup**
```bash
# Using Longhorn snapshots
kubectl get pvc -n monitoring
# Create snapshot via Longhorn UI or API

# Manual backup
kubectl exec -n monitoring deployment/grafana -- \
  tar -czf /tmp/grafana-backup-$(date +%Y%m%d).tar.gz /var/lib/grafana
```

## 🚨 Troubleshooting

### **Common Issues**

#### **1. PVC Not Binding**
```bash
# Check PVC status
kubectl get pvc grafana-pvc -n monitoring

# Check storage class
kubectl get storageclass

# Check events
kubectl describe pvc grafana-pvc -n monitoring
```

#### **2. Permission Issues**
```bash
# Check security context
kubectl exec -n monitoring deployment/grafana -- ls -la /var/lib/grafana

# Fix permissions
kubectl exec -n monitoring deployment/grafana -- \
  chown -R 472:472 /var/lib/grafana
```

#### **3. Migration Issues**
```bash
# Check pod logs
kubectl logs -n monitoring deployment/grafana

# Rollback if needed
kubectl apply -f grafana-deployment-backup.yaml
```

### **Health Checks**
```bash
# Verify Grafana health
kubectl exec -n monitoring deployment/grafana -- \
  curl -s http://localhost:3000/api/health

# Check database
kubectl exec -n monitoring deployment/grafana -- \
  ls -la /var/lib/grafana/grafana.db
```

## 📚 Best Practices

### **Storage Management**
- **Regular Monitoring**: Track storage usage trends
- **Capacity Planning**: Plan for growth
- **Backup Schedule**: Regular database backups
- **Cleanup**: Remove unused dashboards and data

### **Security Considerations**
- **Access Control**: Limit PVC access to Grafana pod
- **Backup Encryption**: Encrypt backup files
- **Network Security**: Secure backup transfer
- **Audit Logging**: Track configuration changes

### **Performance Optimization**
- **Storage Class**: Use fast storage (SSD preferred)
- **Resource Limits**: Set appropriate memory limits
- **Database Optimization**: Regular database maintenance
- **Cache Management**: Monitor cache usage

## 🔄 Maintenance

### **Regular Tasks**
- **Storage Monitoring**: Weekly usage checks
- **Backup Verification**: Monthly backup testing
- **Performance Review**: Quarterly performance analysis
- **Capacity Review**: Annual capacity planning

### **Upgrade Procedures**
- **Backup First**: Always backup before upgrades
- **Test Environment**: Validate in test environment first
- **Rollback Plan**: Have rollback procedure ready
- **Monitoring**: Monitor post-upgrade performance

## 📞 Support

### **Emergency Procedures**
1. **Backup Current State**: Export dashboards and configuration
2. **Check Logs**: Review Grafana and system logs
3. **Verify Storage**: Check PVC status and health
4. **Rollback**: Use backup deployment if needed
5. **Restore**: Restore from backup if data loss occurs

### **Documentation Links**
- [Grafana Documentation](https://grafana.com/docs/)
- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Longhorn Documentation](https://longhorn.io/docs/)

---

**⚠️ Important**: Always backup your Grafana configuration before making changes to storage configuration!
