CREATE TABLE IF NOT EXISTS argus.errors (
  `event_id`         FixedString(32) CODEC(ZSTD(3)),
  `project_id`       String CODEC(ZSTD(3)),
  `issue_id`         UInt64 CODEC(Delta(8), ZSTD(3)),

  `timestamp`        DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `received_at`      DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),

  `platform`         LowCardinality(String),
  `level`            LowCardinality(String),
  `logger`           LowCardinality(String),
  `type`             LowCardinality(String),
  `value`            String CODEC(ZSTD(3)),
  `mechanism`        LowCardinality(String),

  `fingerprint`      Array(String) CODEC(ZSTD(3)),
  `primary_hash`     FixedString(32) CODEC(ZSTD(3)),

  `exception`        String CODEC(ZSTD(3)),
  `stacktrace_frames` String CODEC(ZSTD(3)),
  `breadcrumbs`      String CODEC(ZSTD(3)),

  `user_id`          String CODEC(ZSTD(3)),
  `user_email`       String CODEC(ZSTD(3)),
  `user_ip`          String CODEC(ZSTD(3)),
  `user_name`        String CODEC(ZSTD(3)),

  `environment`      LowCardinality(String),
  `release`          LowCardinality(String),
  `dist`             LowCardinality(String),
  `server_name`      LowCardinality(String),
  `transaction`      String CODEC(ZSTD(3)),

  `os_name`          LowCardinality(String),
  `os_version`       LowCardinality(String),
  `browser_name`     LowCardinality(String),
  `browser_version`  LowCardinality(String),
  `device_name`      LowCardinality(String),
  `device_family`    LowCardinality(String),
  `runtime_name`     LowCardinality(String),
  `runtime_version`  LowCardinality(String),
  `sdk_name`         LowCardinality(String),
  `sdk_version`      LowCardinality(String),

  `geo_country`      LowCardinality(FixedString(2)),
  `geo_city`         String CODEC(ZSTD(3)),
  `geo_region`       LowCardinality(String),

  `http_method`      LowCardinality(String),
  `http_url`         String CODEC(ZSTD(3)),
  `http_referer`     String CODEC(ZSTD(3)),

  `tags`             Map(String, String) CODEC(ZSTD(3)),
  `extra`            Map(String, String) CODEC(ZSTD(3)),
  `contexts`         String CODEC(ZSTD(3)),

  `is_handled`       UInt8 DEFAULT 0,
  `is_symbolicated`  UInt8 DEFAULT 0,

  INDEX idx_type type TYPE bloom_filter GRANULARITY 1,
  INDEX idx_level level TYPE bloom_filter GRANULARITY 1,
  INDEX idx_environment environment TYPE bloom_filter GRANULARITY 1,
  INDEX idx_release release TYPE bloom_filter GRANULARITY 1,
  INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_transaction transaction TYPE bloom_filter GRANULARITY 1,
  INDEX idx_tags_keys mapKeys(tags) TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, toDate(timestamp), issue_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
