-- Daily Metrics Materialized View
CREATE TABLE IF NOT EXISTS event_lens.daily_metrics (
  projectId String,
  date Date,
  uniqueVisitors AggregateFunction(uniq, String),
  totalSessions AggregateFunction(uniq, String),
  totalEvents AggregateFunction(count),
  totalScreenViews AggregateFunction(countIf, String),
  avgDuration AggregateFunction(avg, UInt32)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.daily_metrics_mv
TO event_lens.daily_metrics
AS SELECT
  projectId,
  toDate(createdAt) as date,
  uniqState(deviceId) as uniqueVisitors,
  uniqState(sessionId) as totalSessions,
  countState() as totalEvents,
  countIfState(name, name = 'screen_view') as totalScreenViews,
  avgState(duration) as avgDuration
FROM event_lens.events
GROUP BY projectId, date;

-- Hourly Metrics Materialized View
CREATE TABLE IF NOT EXISTS event_lens.hourly_metrics (
  projectId String,
  hour DateTime,
  uniqueVisitors AggregateFunction(uniq, String),
  totalSessions AggregateFunction(uniq, String),
  totalEvents AggregateFunction(count)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (projectId, hour)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.hourly_metrics_mv
TO event_lens.hourly_metrics
AS SELECT
  projectId,
  toStartOfHour(createdAt) as hour,
  uniqState(deviceId) as uniqueVisitors,
  uniqState(sessionId) as totalSessions,
  countState() as totalEvents
FROM event_lens.events
GROUP BY projectId, hour;

