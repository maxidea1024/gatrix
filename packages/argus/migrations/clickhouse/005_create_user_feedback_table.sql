CREATE TABLE IF NOT EXISTS argus.user_feedback (
  `feedback_id`        String CODEC(ZSTD(3)),
  `project_id`         String CODEC(ZSTD(3)),
  `event_id`           FixedString(32) CODEC(ZSTD(3)),

  `timestamp`          DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),

  `name`               String CODEC(ZSTD(3)),
  `email`              String CODEC(ZSTD(3)),
  `message`            String CODEC(ZSTD(3)),
  `contact_email`      String CODEC(ZSTD(3)),
  `url`                String CODEC(ZSTD(3)),

  `environment`        LowCardinality(String),
  `release`            LowCardinality(String),
  `source`             LowCardinality(String),
  `tags`               Map(String, String) CODEC(ZSTD(3)),

  INDEX idx_event event_id TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
