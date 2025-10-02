-- Events 테이블 생성
CREATE TABLE IF NOT EXISTS event_lens.events (
  id String,
  projectId String,
  name String,
  deviceId String,
  profileId Nullable(String),
  sessionId String,
  createdAt DateTime,
  timestamp DateTime,
  
  -- Geo
  country Nullable(String),
  city Nullable(String),
  region Nullable(String),
  latitude Nullable(Float64),
  longitude Nullable(Float64),
  
  -- Device
  os Nullable(String),
  osVersion Nullable(String),
  browser Nullable(String),
  browserVersion Nullable(String),
  device Nullable(String),
  brand Nullable(String),
  model Nullable(String),
  
  -- Page
  path Nullable(String),
  origin Nullable(String),
  referrer Nullable(String),
  referrerName Nullable(String),
  referrerType Nullable(String),
  
  -- UTM
  utmSource Nullable(String),
  utmMedium Nullable(String),
  utmCampaign Nullable(String),
  utmTerm Nullable(String),
  utmContent Nullable(String),
  
  -- Custom
  properties String DEFAULT '{}',
  
  -- Session metrics
  duration Nullable(UInt32),
  screenViews Nullable(UInt32),
  
  -- Raw data
  ip Nullable(String),
  userAgent Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, createdAt, deviceId)
SETTINGS index_granularity = 8192;

-- Indexes
ALTER TABLE event_lens.events ADD INDEX idx_name name TYPE bloom_filter GRANULARITY 1;
ALTER TABLE event_lens.events ADD INDEX idx_session sessionId TYPE bloom_filter GRANULARITY 1;
ALTER TABLE event_lens.events ADD INDEX idx_profile profileId TYPE bloom_filter GRANULARITY 1;

