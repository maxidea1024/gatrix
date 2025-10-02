-- ============================================================================
-- Sessions 테이블 생성 (OpenPanel 최적화 적용)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_lens.sessions (
  `session_id` String CODEC(LZ4),
  `project_id` String CODEC(ZSTD(3)),
  `device_id` String CODEC(ZSTD(3)),
  `profile_id` Nullable(String) CODEC(ZSTD(3)),

  -- Session metrics (Delta 압축)
  `duration` UInt32 CODEC(Delta(4), LZ4),
  `screen_views` UInt32 CODEC(Delta(4), LZ4),
  `events` UInt32 CODEC(Delta(4), LZ4),
  `bounced` Bool,

  -- First event data
  `country` LowCardinality(FixedString(2)),
  `city` String,
  `region` LowCardinality(String),
  `os` LowCardinality(String),
  `browser` LowCardinality(String),
  `device` LowCardinality(String),
  `referrer` String CODEC(ZSTD(3)),
  `referrer_name` String CODEC(ZSTD(3)),
  `referrer_type` LowCardinality(String),

  -- Timestamps
  `created_at` DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `ended_at` Nullable(DateTime64(3)) CODEC(DoubleDelta, ZSTD(3)),

  -- Sign for ReplacingMergeTree
  `sign` Int8,

  -- Bloom Filter Indexes
  INDEX idx_device device_id TYPE bloom_filter GRANULARITY 1,
  INDEX idx_profile profile_id TYPE bloom_filter GRANULARITY 1
)
ENGINE = ReplacingMergeTree(created_at, sign)
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, session_id)
SETTINGS index_granularity = 8192;

-- TTL 설정 (90일 후 자동 삭제)
ALTER TABLE event_lens.sessions
MODIFY TTL created_at + INTERVAL 90 DAY;

