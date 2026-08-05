#!/bin/bash
set -euo pipefail

# P3-07: Backup restore verification script
# Verifies that a database backup can be successfully restored.
# Usage: ./scripts/verify-backup.sh [backup_file]
# If no backup_file is provided, uses the most recent backup in BACKUP_DIR.

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-$(docker compose -f docker-compose.prod.yml ps -q postgres 2>/dev/null || echo '')}"
VERIFY_DB="${VERIFY_DB:-help_center_verify}"
RETAIN_VERIFY_DB="${RETAIN_VERIFY_DB:-false}"

# Determine backup file
if [ -n "${1:-}" ]; then
    BACKUP_FILE="$1"
else
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/help_center_*.sql.gz 2>/dev/null | head -1)
fi

if [ -z "${BACKUP_FILE:-}" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "[$(date)] ERROR: No backup file found. Provide a path or ensure ${BACKUP_DIR} contains backups."
    exit 1
fi

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Verifying backup: $BACKUP_FILE ($FILESIZE)"

# Step 1: Check the backup file is non-empty and valid gzip
echo "[$(date)] Step 1: Checking gzip integrity..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "[$(date)] FAIL: Backup file is corrupt or not a valid gzip archive."
    exit 1
fi
echo "[$(date)]   ✅ Gzip integrity OK"

# Step 2: Extract and check SQL content
echo "[$(date)] Step 2: Checking SQL content..."
SQL_CHECK=$(zcat "$BACKUP_FILE" | head -5)
if [ -z "$SQL_CHECK" ]; then
    echo "[$(date)] FAIL: Backup file contains no SQL content."
    exit 1
fi

TABLE_COUNT=$(zcat "$BACKUP_FILE" | grep -c "CREATE TABLE" || true)
echo "[$(date)]   ✅ SQL content present (${TABLE_COUNT} CREATE TABLE statements)"

# Step 3: If DB_CONTAINER is available, test restore to a temporary database
if [ -n "$DB_CONTAINER" ]; then
    echo "[$(date)] Step 3: Restoring to verification database '${VERIFY_DB}'..."

    # Drop existing verify database if it exists
    docker exec "$DB_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null || true
    docker exec "$DB_CONTAINER" psql -U postgres -c "CREATE DATABASE ${VERIFY_DB};" 2>/dev/null

    # Restore backup into verify database
    zcat "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U postgres -d "$VERIFY_DB" >/tmp/verify-restore.log 2>&1
    RESTORE_EXIT=$?

    if [ $RESTORE_EXIT -ne 0 ]; then
        echo "[$(date)]   ❌ Restore FAILED (exit code ${RESTORE_EXIT})"
        cat /tmp/verify-restore.log 2>/dev/null || true
        # Cleanup
        docker exec "$DB_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null || true
        exit 1
    fi

    # Count restored tables
    RESTORED_TABLES=$(docker exec "$DB_CONTAINER" psql -U postgres -d "$VERIFY_DB" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    echo "[$(date)]   ✅ Restore OK (${RESTORED_TABLES} tables restored)"

    # Step 4: Check row counts for critical tables
    echo "[$(date)] Step 4: Checking critical table row counts..."
    CRITICAL_TABLES="users requests service_desks request_types"
    for table in $CRITICAL_TABLES; do
        ROWS=$(docker exec "$DB_CONTAINER" psql -U postgres -d "$VERIFY_DB" -t -c \
            "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ')
        if [ "${ROWS:-0}" -gt 0 ] 2>/dev/null; then
            echo "[$(date)]   ✅ ${table}: ${ROWS} rows"
        else
            echo "[$(date)]   ⚠️  ${table}: 0 rows (may be empty in fresh backup)"
        fi
    done

    # Cleanup verification database unless RETAIN_VERIFY_DB=true
    if [ "$RETAIN_VERIFY_DB" != "true" ]; then
        echo "[$(date)] Cleaning up verification database..."
        docker exec "$DB_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null || true
    else
        echo "[$(date)] Keeping verification database '${VERIFY_DB}' for manual inspection."
    fi
else
    echo "[$(date)] Step 3: SKIPPED — no DB_CONTAINER available for restore test."
    echo "[$(date)]   To enable restore verification, set DB_CONTAINER or run with Docker Compose."
fi

# Step 5: Verify S3/attachment backup if configured
S3_BACKUP_DIR="${BACKUP_DIR}/attachments"
if [ -d "$S3_BACKUP_DIR" ]; then
    ATTACHMENT_COUNT=$(find "$S3_BACKUP_DIR" -type f | wc -l | tr -d ' ')
    echo "[$(date)] Step 5: Attachment backup contains ${ATTACHMENT_COUNT} files"
else
    echo "[$(date)] Step 5: No attachment backup directory found at ${S3_BACKUP_DIR}"
fi

echo "[$(date)] ✅ Backup verification complete."