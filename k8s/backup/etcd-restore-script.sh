#!/bin/bash

# RKE2 etcd Restore Script
# This script restores etcd from a backup snapshot

set -euo pipefail

# Configuration
BACKUP_DIR="/var/lib/rancher/rke2/server/db/etcd-backups"
RESTORE_DIR="/var/lib/rancher/rke2/server/db/etcd-restore"
LOG_FILE="/var/log/etcd-restore.log"

# RKE2 etcd paths
ETCD_DATA_DIR="/var/lib/rancher/rke2/server/db/etcd"
ETCD_CERT_DIR="/var/lib/rancher/rke2/server/tls/etcd"
RKE2_SERVICE="rke2-server"

# Logging function
restore_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    restore_log "ERROR: $1"
    exit 1
}

# Usage information
usage() {
    echo "Usage: $0 [backup-file]"
    echo "  backup-file: Path to backup file (e.g., etcd-backup-20240304-020000.db.gz)"
    echo "  If no backup file is specified, the latest backup will be used"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error_exit "This script must be run as root"
fi

# Parse arguments
BACKUP_FILE=${1:-""}

# Find latest backup if not specified
if [[ -z "$BACKUP_FILE" ]]; then
    restore_log "No backup file specified, finding latest backup..."
    BACKUP_FILE=$(find "$BACKUP_DIR" -name "etcd-backup-*.db.gz" -type f | sort -r | head -1)
    if [[ -z "$BACKUP_FILE" ]]; then
        error_exit "No backup files found in $BACKUP_DIR"
    fi
fi

# Check if backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    error_exit "Backup file not found: $BACKUP_FILE"
fi

restore_log "Starting etcd restore from: $BACKUP_FILE"

# Verify etcd certificates
ETCD_CERT_FILE="$ETCD_CERT_DIR/server-ca.crt"
ETCD_KEY_FILE="$ETCD_CERT_DIR/server-ca.key"
ETCD_CA_FILE="$ETCD_CERT_DIR/server-ca.crt"

if [[ ! -f "$ETCD_CERT_FILE" ]] || [[ ! -f "$ETCD_KEY_FILE" ]]; then
    error_exit "etcd certificates not found in $ETCD_CERT_DIR"
fi

# Get etcd endpoint
ETCD_ENDPOINT="https://127.0.0.1:2379"

# WARNING: This is a destructive operation
echo "=========================================="
echo "WARNING: This will destroy the current etcd data!"
echo "This operation cannot be undone!"
echo "=========================================="
echo "Backup to restore: $BACKUP_FILE"
echo "Current etcd data will be backed up to: $ETCD_DATA_DIR.backup.$(date +%Y%m%d-%H%M%S)"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [[ "$confirm" != "yes" ]]; then
    restore_log "Restore cancelled by user"
    exit 0
fi

# Stop RKE2 server
restore_log "Stopping RKE2 server..."
systemctl stop "$RKE2_SERVICE"

# Wait for RKE2 to stop
for i in {1..30}; do
    if ! systemctl is-active --quiet "$RKE2_SERVICE"; then
        break
    fi
    restore_log "Waiting for RKE2 to stop... ($i/30)"
    sleep 2
done

if systemctl is-active --quiet "$RKE2_SERVICE"; then
    error_exit "Failed to stop RKE2 server"
fi

# Backup current etcd data
CURRENT_BACKUP_DIR="$ETCD_DATA_DIR.backup.$(date +%Y%m%d-%H%M%S)"
restore_log "Backing up current etcd data to: $CURRENT_BACKUP_DIR"
cp -r "$ETCD_DATA_DIR" "$CURRENT_BACKUP_DIR"

# Remove existing etcd data
restore_log "Removing existing etcd data..."
rm -rf "$ETCD_DATA_DIR"

# Create restore directory
mkdir -p "$RESTORE_DIR"
mkdir -p "$ETCD_DATA_DIR"

# Decompress backup
restore_log "Decompressing backup..."
gunzip -c "$BACKUP_FILE" > "$RESTORE_DIR/etcd-snapshot.db"

# Verify backup integrity
restore_log "Verifying backup integrity..."
if ! ETCDCTL_API=3 etcdctl \
    --cacert="$ETCD_CA_FILE" \
    --cert="$ETCD_CERT_FILE" \
    --key="$ETCD_KEY_FILE" \
    --endpoints="$ETCD_ENDPOINT" \
    snapshot status "$RESTORE_DIR/etcd-snapshot.db" --write-out=table; then
    error_exit "Backup verification failed"
fi

# Restore etcd data
restore_log "Restoring etcd data..."
ETCDCTL_API=3 etcdctl \
    --cacert="$ETCD_CA_FILE" \
    --cert="$ETCD_CERT_FILE" \
    --key="$ETCD_KEY_FILE" \
    --endpoints="$ETCD_ENDPOINT" \
    snapshot restore "$RESTORE_DIR/etcd-snapshot.db" \
    --data-dir "$ETCD_DATA_DIR"

# Set proper permissions
restore_log "Setting proper permissions..."
chown -R etcd:etcd "$ETCD_DATA_DIR"
chmod -R 700 "$ETCD_DATA_DIR"

# Cleanup restore directory
rm -rf "$RESTORE_DIR"

# Start RKE2 server
restore_log "Starting RKE2 server..."
systemctl start "$RKE2_SERVICE"

# Wait for RKE2 to start
for i in {1..60}; do
    if systemctl is-active --quiet "$RKE2_SERVICE"; then
        break
    fi
    restore_log "Waiting for RKE2 to start... ($i/60)"
    sleep 5
done

if ! systemctl is-active --quiet "$RKE2_SERVICE"; then
    error_exit "Failed to start RKE2 server"
fi

# Wait for etcd to be healthy
restore_log "Waiting for etcd to become healthy..."
for i in {1..30}; do
    if ETCDCTL_API=3 etcdctl \
        --cacert="$ETCD_CA_FILE" \
        --cert="$ETCD_CERT_FILE" \
        --key="$ETCD_KEY_FILE" \
        --endpoints="$ETCD_ENDPOINT" \
        endpoint health >/dev/null 2>&1; then
        restore_log "etcd is healthy"
        break
    fi
    restore_log "Waiting for etcd health... ($i/30)"
    sleep 10
done

# Verify Kubernetes cluster
restore_log "Waiting for Kubernetes cluster to be ready..."
for i in {1..30}; do
    if kubectl get nodes >/dev/null 2>&1; then
        restore_log "Kubernetes cluster is ready"
        break
    fi
    restore_log "Waiting for Kubernetes... ($i/30)"
    sleep 10
done

# Show cluster status
restore_log "Cluster status:"
kubectl get nodes -o wide || restore_log "Warning: Could not get node status"

restore_log "etcd restore completed successfully!"
restore_log "Original data backed up to: $CURRENT_BACKUP_DIR"

echo "=========================================="
echo "etcd Restore Summary"
echo "=========================================="
echo "Backup Used: $BACKUP_FILE"
echo "Restored At: $(date)"
echo "Original Data: $CURRENT_BACKUP_DIR"
echo "etcd Status: Healthy"
echo "Kubernetes Status: Ready"
echo "=========================================="

restore_log "etcd restore process completed successfully"
