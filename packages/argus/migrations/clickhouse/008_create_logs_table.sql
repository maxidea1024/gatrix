-- Structured logs table for Argus
-- Logs are connected to errors via trace_id
CREATE TABLE IF NOT EXISTS argus.logs (
  `log_id`       String CODEC(ZSTD(3)),
  `project_id`   String CODEC(ZSTD(3)),
  `trace_id`     String CODEC(ZSTD(3)),
  `span_id`      String CODEC(ZSTD(3)),
  `issue_id`     UInt64 CODEC(Delta(8), ZSTD(3)),

  `timestamp`    DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),

  `level`        LowCardinality(String),
  `logger_name`  LowCardinality(String),
  `message`      String CODEC(ZSTD(3)),
  `body`         String CODEC(ZSTD(3)),

  `environment`  LowCardinality(String),
  `release`      LowCardinality(String),
  `service`      LowCardinality(String),

  `attributes`   Map(String, String) CODEC(ZSTD(3)),

  INDEX idx_trace_id trace_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_issue_id issue_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_level level TYPE bloom_filter GRANULARITY 1,
  INDEX idx_message message TYPE tokenbf_v1(10240, 3, 0) GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), trace_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
