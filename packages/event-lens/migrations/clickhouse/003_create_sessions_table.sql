-- Sessions 테이블 생성
CREATE TABLE IF NOT EXISTS event_lens.sessions (
  sessionId String,
  projectId String,
  deviceId String,
  profileId Nullable(String),
  startTime DateTime,
  endTime DateTime,
  duration UInt32,
  screenViews UInt32,
  isBounce UInt8,
  country Nullable(String),
  city Nullable(String),
  browser Nullable(String),
  os Nullable(String),
  referrer Nullable(String),
  createdAt DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, createdAt, sessionId)
SETTINGS index_granularity = 8192;

-- Indexes
ALTER TABLE event_lens.sessions ADD INDEX idx_device deviceId TYPE bloom_filter GRANULARITY 1;
ALTER TABLE event_lens.sessions ADD INDEX idx_profile profileId TYPE bloom_filter GRANULARITY 1;

