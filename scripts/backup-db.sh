#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-$(docker compose -f docker-compose.prod.yml ps -q postgres)}"
S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/help_center_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump and compress
docker exec "$DB_CONTAINER" pg_dump -U postgres help_center | gzip > "$BACKUP_FILE"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[$(date)] ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Database backup created: $BACKUP_FILE ($FILESIZE)"

# P3-08: Attachment backup
# If S3 is configured, sync attachments to the backup directory.
# If using local uploads (SERVE_LOCAL_UPLOADS=true), tar the uploads directory.
ATTACHMENT_BACKUP_DIR="${BACKUP_DIR}/attachments"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"

if [ -n "$S3_BUCKET" ]; then
    echo "[$(date)] Syncing S3 attachments to backup..."
    mkdir -p "$ATTACHMENT_BACKUP_DIR"
    S3_CMD="aws s3 sync s3://${S3_BUCKET} ${ATTACHMENT_BACKUP_DIR}/"
    if [ -n "$S3_ENDPOINT" ]; then
        S3_CMD="$S3_CMD --endpoint-url $S3_ENDPOINT"
    fi
    # shellcheck disable=SC2086
    if eval "$S3_CMD"; then
        ATTACHMENT_COUNT=$(find "$ATTACHMENT_BACKUP_DIR" -type f | wc -l | tr -d ' ')
        echo "[$(date)] S3 attachment backup: ${ATTACHMENT_COUNT} files synced"
    else
        echo "[$(date)] WARNING: S3 sync failed — attachment backup incomplete"
    fi
elif [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo "[$(date)] Creating local uploads archive..."
    ATTACHMENT_ARCHIVE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
    tar -czf "$ATTACHMENT_ARCHIVE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")" 2>/dev/null || {
        echo "[$(date)] WARNING: Local uploads archive failed"
        rm -f "$ATTACHMENT_ARCHIVE"
    }
    if [ -s "${ATTACHMENT_ARCHIVE:-}" ]; then
        ATTACHMENT_SIZE=$(du -h "$ATTACHMENT_ARCHIVE" | cut -f1)
        echo "[$(date)] Local uploads backup: $ATTACHMENT_ARCHIVE ($ATTACHMENT_SIZE)"
    fi
else
    echo "[$(date)] No attachments to back up (S3_BUCKET not set, uploads dir empty or missing)"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "help_center_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup complete."