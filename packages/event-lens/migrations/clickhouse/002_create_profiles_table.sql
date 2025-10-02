-- Profiles 테이블 생성 (ReplacingMergeTree for upsert)
CREATE TABLE IF NOT EXISTS event_lens.profiles (
  id String,
  projectId String,
  profileId String,
  firstName Nullable(String),
  lastName Nullable(String),
  email Nullable(String),
  avatar Nullable(String),
  properties String DEFAULT '{}',
  firstSeenAt DateTime,
  lastSeenAt DateTime,
  createdAt DateTime
)
ENGINE = ReplacingMergeTree(createdAt)
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, profileId)
SETTINGS index_granularity = 8192;

-- Indexes
ALTER TABLE event_lens.profiles ADD INDEX idx_email email TYPE bloom_filter GRANULARITY 1;

