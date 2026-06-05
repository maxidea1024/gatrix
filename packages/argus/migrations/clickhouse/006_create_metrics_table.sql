CREATE TABLE IF NOT EXISTS argus.metrics (
  `project_id`         String CODEC(ZSTD(3)),
  `metric_type`        LowCardinality(String),
  `name`               LowCardinality(String),
  `unit`               LowCardinality(String),

  `timestamp`          DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),

  `value_counter`      Float64 CODEC(Gorilla, ZSTD(3)),
  `value_gauge`        Float64 CODEC(Gorilla, ZSTD(3)),
  `value_distribution` Array(Float64) CODEC(ZSTD(3)),
  `value_set`          Array(String) CODEC(ZSTD(3)),

  `environment`        LowCardinality(String),
  `release`            LowCardinality(String),
  `tags`               Map(String, String) CODEC(ZSTD(3)),

  INDEX idx_name name TYPE bloom_filter GRANULARITY 1,
  INDEX idx_type metric_type TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, name, toDate(timestamp), timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
