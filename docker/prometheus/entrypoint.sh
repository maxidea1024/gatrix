#!/bin/sh
# Simple entrypoint to render prometheus.yml from a template using ENV values
# SCRAPE_INTERVAL and RETENTION are configurable via env; defaults are set here.
set -e

SCRAPE_INTERVAL="${PROM_SCRAPE_INTERVAL:-15s}"
RETENTION="${PROM_RETENTION_TIME:-14d}"

# Copy base template and replace placeholders
cp /etc/prometheus/prometheus.base.yml /etc/prometheus/prometheus.yml
if command -v sed >/dev/null 2>&1; then
  sed -i "s/__SCRAPE_INTERVAL__/${SCRAPE_INTERVAL}/g" /etc/prometheus/prometheus.yml
else
  echo "[prometheus-entrypoint] 'sed' not found; using defaults in template"
fi

exec /bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.retention.time="${RETENTION}" \
  --web.enable-lifecycle

