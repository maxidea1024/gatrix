CREATE TABLE IF NOT EXISTS argus.sessions (
  `session_id`         String CODEC(ZSTD(3)),
  `project_id`         String CODEC(ZSTD(3)),

  `timestamp`          DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `started`            DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),

  `status`             LowCardinality(String),
  `seq`                UInt64 CODEC(Delta(4), ZSTD(3)),
  `duration`           Nullable(UInt64) CODEC(ZSTD(3)),
  `errors`             UInt32 DEFAULT 0,

  `environment`        LowCardinality(String),
  `release`            LowCardinality(String),
  `distinct_id`        String CODEC(ZSTD(3)),
  `user_agent`         String CODEC(ZSTD(3)),

  INDEX idx_session session_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_release release TYPE bloom_filter GRANULARITY 1,
  INDEX idx_status status TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), release, session_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
