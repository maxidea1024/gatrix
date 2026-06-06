-- ClickHouse: Cron and Uptime Check-in Time-Series Tables
-- Moves check-in telemetry data from MySQL to ClickHouse for better
-- write throughput and long-term query performance.

-- Cron Check-ins
CREATE TABLE IF NOT EXISTS argus.cron_checkins (
  monitor_id      UInt64,
  project_id      String,
  checkin_id      String,
  status          LowCardinality(String),
  duration        Nullable(UInt32),
  environment     LowCardinality(String),
  expected_time   Nullable(DateTime),
  timeout_at      Nullable(DateTime),
  trace_id        Nullable(String),
  timestamp       DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, monitor_id, timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- Uptime Check-ins
CREATE TABLE IF NOT EXISTS argus.uptime_checkins (
  monitor_id      UInt64,
  project_id      String,
  status          LowCardinality(String),
  response_ms     UInt32,
  status_code     Nullable(UInt16),
  error_message   Nullable(String),
  timestamp       DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, monitor_id, timestamp)
TTL timestamp + INTERVAL 90 DAY;
