#!/bin/bash
# TriVanta Health Check
# Add to cron (VPS): */5 * * * * /home/trivanta/trivanta/healthcheck.sh
# Checks /api/health, logs status, restarts PM2 process if down 3x in a row.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/api/health}"
LOG_FILE="$APP_DIR/logs/healthcheck.log"
FAIL_COUNT_FILE="$APP_DIR/logs/health-fail-count"
MAX_FAILURES=3
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$APP_DIR/logs"

log() { echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"; }

# Read current consecutive failure count
failures=0
if [[ -f "$FAIL_COUNT_FILE" ]]; then
  failures=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)
fi

# Hit the health endpoint (5s connect timeout, 10s read timeout)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 --max-time 10 \
  "$HEALTH_URL" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  if [[ "$failures" -gt 0 ]]; then
    log "RECOVERED  (was down $failures check(s)) — HTTP $HTTP_STATUS"
  else
    log "OK  HTTP $HTTP_STATUS"
  fi
  echo 0 > "$FAIL_COUNT_FILE"
else
  failures=$((failures + 1))
  echo "$failures" > "$FAIL_COUNT_FILE"
  log "FAIL  HTTP $HTTP_STATUS  (consecutive failures: $failures / $MAX_FAILURES)"

  if [[ "$failures" -ge "$MAX_FAILURES" ]]; then
    log "RESTART  Threshold reached — restarting PM2 process 'trivanta'"
    if command -v pm2 &>/dev/null; then
      pm2 restart trivanta >> "$LOG_FILE" 2>&1 || log "ERROR  pm2 restart failed"
    else
      log "WARN  pm2 not found — manual restart needed"
    fi
    # Reset counter so we don't restart on every subsequent check
    echo 0 > "$FAIL_COUNT_FILE"
  fi
fi

# Rotate log if it exceeds 5 MB
LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
if [[ "$LOG_SIZE" -gt 5242880 ]]; then
  mv "$LOG_FILE" "$LOG_FILE.1"
  log "LOG ROTATED  previous log moved to healthcheck.log.1"
fi
