-- ============================================================================
-- Profiles 테이블 생성 (OpenPanel 최적화 적용)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_lens.profiles (
  `id` String CODEC(ZSTD(3)),
  `is_external` Bool,
  `first_name` String CODEC(ZSTD(3)),
  `last_name` String CODEC(ZSTD(3)),
  `email` String CODEC(ZSTD(3)),
  `avatar` String CODEC(ZSTD(3)),
  `properties` Map(String, String) CODEC(ZSTD(3)),
  `project_id` String CODEC(ZSTD(3)),
  `created_at` DateTime64(3) CODEC(Delta(4), LZ4),

  INDEX idx_first_name first_name TYPE bloom_filter GRANULARITY 1,
  INDEX idx_last_name last_name TYPE bloom_filter GRANULARITY 1,
  INDEX idx_email email TYPE bloom_filter GRANULARITY 1
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, id)
SETTINGS index_granularity = 8192;

-- TTL 설정 (365일 후 자동 삭제)
ALTER TABLE event_lens.profiles
MODIFY TTL created_at + INTERVAL 365 DAY;

