#!/bin/bash

# RKE2 etcd Backup Script
# This script creates snapshots of the etcd database for disaster recovery

set -euo pipefail

# Configuration
BACKUP_DIR="/var/lib/rancher/rke2/server/db/etcd-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="etcd-backup-${TIMESTAMP}"
LOG_FILE="/var/log/etcd-backup.log"

# RKE2 etcd paths
ETCD_DATA_DIR="/var/lib/rancher/rke2/server/db/etcd"
ETCD_CONFIG_FILE="/var/lib/rancher/rke2/server/db/etcd/config"
ETCD_CERT_DIR="/var/lib/rancher/rke2/server/tls/etcd"

# Logging function
backup_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    backup_log "ERROR: $1"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error_exit "This script must be run as root"
fi

# Check if RKE2 is running
if ! systemctl is-active --quiet rke2-server; then
    error_exit "RKE2 server is not running"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
backup_log "Starting etcd backup: $BACKUP_NAME"

# Verify etcd data directory exists
if [[ ! -d "$ETCD_DATA_DIR" ]]; then
    error_exit "etcd data directory not found: $ETCD_DATA_DIR"
fi

# Check etcd certificates
ETCD_CERT_FILE="$ETCD_CERT_DIR/server-ca.crt"
ETCD_KEY_FILE="$ETCD_CERT_DIR/server-ca.key"
ETCD_CA_FILE="$ETCD_CERT_DIR/server-ca.crt"

if [[ ! -f "$ETCD_CERT_FILE" ]] || [[ ! -f "$ETCD_KEY_FILE" ]]; then
    error_exit "etcd certificates not found in $ETCD_CERT_DIR"
fi

# Get etcd endpoint
ETCD_ENDPOINT="https://127.0.0.1:2379"

# Test etcd connectivity
if ! ETCDCTL_API=3 etcdctl \
    --cacert="$ETCD_CA_FILE" \
    --cert="$ETCD_CERT_FILE" \
    --key="$ETCD_KEY_FILE" \
    --endpoints="$ETCD_ENDPOINT" \
    endpoint health >/dev/null 2>&1; then
    error_exit "Cannot connect to etcd at $ETCD_ENDPOINT"
fi

# Create etcd snapshot
backup_log "Creating etcd snapshot..."
ETCDCTL_API=3 etcdctl \
    --cacert="$ETCD_CA_FILE" \
    --cert="$ETCD_CERT_FILE" \
    --key="$ETCD_KEY_FILE" \
    --endpoints="$ETCD_ENDPOINT" \
    snapshot save "$BACKUP_DIR/$BACKUP_NAME.db"

# Verify snapshot
backup_log "Verifying snapshot integrity..."
if ETCDCTL_API=3 etcdctl \
    --cacert="$ETCD_CA_FILE" \
    --cert="$ETCD_CERT_FILE" \
    --key="$ETCD_KEY_FILE" \
    --endpoints="$ETCD_ENDPOINT" \
    snapshot status "$BACKUP_DIR/$BACKUP_NAME.db" --write-out=table; then
    backup_log "Snapshot verification successful"
else
    error_exit "Snapshot verification failed"
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/$BACKUP_NAME-metadata.json"
cat > "$METADATA_FILE" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -Iseconds)",
  "etcd_version": "$(ETCDCTL_API=3 etcdctl --cacert=$ETCD_CA_FILE --cert=$ETCD_CERT_FILE --key=$ETCD_KEY_FILE --endpoints=$ETCD_ENDPOINT version 2>/dev/null | grep 'etcdserver' | cut -d':' -f2 | tr -d '[:space:]' || echo 'unknown')",
  "node_hostname": "$(hostname)",
  "node_ip": "$(hostname -I | awk '{print $1}')",
  "kubernetes_version": "$(kubectl version --short 2>/dev/null | grep 'Server Version' | cut -d':' -f2 | tr -d '[:space:]' || echo 'unknown')",
  "snapshot_size": "$(stat -f%z "$BACKUP_DIR/$BACKUP_NAME.db")",
  "snapshot_checksum": "$(sha256sum "$BACKUP_DIR/$BACKUP_NAME.db" | cut -d' ' -f1)",
  "backup_script_version": "1.0"
}
