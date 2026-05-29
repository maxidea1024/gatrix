CREATE TABLE IF NOT EXISTS argus.spans (
  `span_id`            FixedString(16) CODEC(ZSTD(3)),
  `trace_id`           FixedString(32) CODEC(ZSTD(3)),
  `parent_span_id`     FixedString(16) CODEC(ZSTD(3)),
  `transaction_id`     FixedString(32) CODEC(ZSTD(3)),
  `project_id`         String CODEC(ZSTD(3)),

  `timestamp`          DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `start_timestamp`    DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `duration`           UInt64 CODEC(Delta(4), ZSTD(3)),

  `op`                 LowCardinality(String),
  `description`        String CODEC(ZSTD(3)),
  `status`             LowCardinality(String),
  `action`             LowCardinality(String),
  `domain`             LowCardinality(String),

  `data`               Map(String, String) CODEC(ZSTD(3)),
  `tags`               Map(String, String) CODEC(ZSTD(3)),

  INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_op op TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), trace_id, span_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
