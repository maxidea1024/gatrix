-- Error frequency hourly aggregation
CREATE TABLE IF NOT EXISTS argus.error_frequency_hourly (
  project_id String,
  issue_id UInt64,
  environment LowCardinality(String),
  `release` LowCardinality(String),
  hour DateTime,
  event_count AggregateFunction(count),
  affected_users AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, issue_id, hour);

CREATE MATERIALIZED VIEW IF NOT EXISTS argus.error_frequency_hourly_mv
TO argus.error_frequency_hourly AS SELECT
  project_id, issue_id, environment, `release`,
  toStartOfHour(timestamp) AS hour,
  countState() AS event_count,
  uniqState(user_id) AS affected_users
FROM argus.errors
GROUP BY project_id, issue_id, environment, `release`, hour;

-- Transaction performance hourly aggregation
CREATE TABLE IF NOT EXISTS argus.transaction_metrics_hourly (
  project_id String,
  transaction String,
  environment LowCardinality(String),
  hour DateTime,
  txn_count AggregateFunction(count),
  avg_duration AggregateFunction(avg, UInt64),
  duration_quantiles AggregateFunction(quantiles(0.5, 0.75, 0.95, 0.99), UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, transaction, hour);

CREATE MATERIALIZED VIEW IF NOT EXISTS argus.transaction_metrics_hourly_mv
TO argus.transaction_metrics_hourly AS SELECT
  project_id, transaction, environment,
  toStartOfHour(timestamp) AS hour,
  countState() AS txn_count,
  avgState(duration) AS avg_duration,
  quantilesState(0.5, 0.75, 0.95, 0.99)(duration) AS duration_quantiles
FROM argus.transactions
GROUP BY project_id, transaction, environment, hour;

-- Session health daily aggregation
CREATE TABLE IF NOT EXISTS argus.session_health_daily (
  project_id String,
  `release` LowCardinality(String),
  environment LowCardinality(String),
  day Date,
  total_sessions AggregateFunction(count),
  crashed_sessions AggregateFunction(countIf, UInt8),
  total_users AggregateFunction(uniq, String),
  crashed_users AggregateFunction(uniqIf, String, UInt8)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (project_id, `release`, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS argus.session_health_daily_mv
TO argus.session_health_daily AS SELECT
  project_id, `release`, environment,
  toDate(timestamp) AS day,
  countState() AS total_sessions,
  countIfState(status = 'crashed') AS crashed_sessions,
  uniqState(distinct_id) AS total_users,
  uniqIfState(distinct_id, status = 'crashed') AS crashed_users
FROM argus.sessions
GROUP BY project_id, `release`, environment, day;
