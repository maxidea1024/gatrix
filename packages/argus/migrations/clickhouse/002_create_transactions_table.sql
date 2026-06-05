CREATE TABLE IF NOT EXISTS argus.transactions (
  `event_id`           FixedString(32) CODEC(ZSTD(3)),
  `trace_id`           FixedString(32) CODEC(ZSTD(3)),
  `span_id`            FixedString(16) CODEC(ZSTD(3)),
  `parent_span_id`     FixedString(16) CODEC(ZSTD(3)),
  `project_id`         String CODEC(ZSTD(3)),

  `timestamp`          DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `start_timestamp`    DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `duration`           UInt64 CODEC(Delta(4), ZSTD(3)),

  `transaction`        String CODEC(ZSTD(3)),
  `transaction_op`     LowCardinality(String),
  `transaction_status` LowCardinality(String),
  `http_method`        LowCardinality(String),
  `http_status_code`   UInt16 CODEC(Delta(2), ZSTD(3)),

  `platform`           LowCardinality(String),
  `environment`        LowCardinality(String),
  `release`            LowCardinality(String),
  `user_id`            String CODEC(ZSTD(3)),

  `measurements`       Map(String, Float64) CODEC(ZSTD(3)),
  `tags`               Map(String, String) CODEC(ZSTD(3)),
  `span_count`         UInt32 CODEC(Delta(4), ZSTD(3)),

  INDEX idx_trace_id trace_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_transaction transaction TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_status transaction_status TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), transaction, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
