-- ============================================================================
-- OpenPanel 스타일 최적화 적용
-- ============================================================================
-- 이 마이그레이션은 OpenPanel에서 사용하는 고급 최적화 기술을 적용합니다:
-- 1. LowCardinality 타입
-- 2. 고급 압축 코덱 (Delta, DoubleDelta, Gorilla)
-- 3. Map 타입 (properties)
-- 4. FixedString 타입
-- 5. ORDER BY 최적화
-- ============================================================================

-- ============================================================================
-- STEP 1: 새로운 최적화된 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_lens.events_optimized (
  -- IDs
  id String,
  projectId String CODEC(ZSTD(3)),
  name LowCardinality(String),
  deviceId String CODEC(ZSTD(3)),
  profileId Nullable(String) CODEC(ZSTD(3)),
  sessionId String CODEC(LZ4),
  
  -- Timestamps
  createdAt DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  timestamp DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  
  -- Geo (Gorilla 압축은 Float 시계열 데이터에 최적)
  country LowCardinality(FixedString(2)),
  city String,
  region LowCardinality(String),
  latitude Nullable(Float32) CODEC(Gorilla, LZ4),
  longitude Nullable(Float32) CODEC(Gorilla, LZ4),
  
  -- Device (LowCardinality로 메모리 30-50% 절감)
  os LowCardinality(String),
  osVersion LowCardinality(String),
  browser LowCardinality(String),
  browserVersion LowCardinality(String),
  device LowCardinality(String),
  brand LowCardinality(String),
  model LowCardinality(String),
  
  -- Page
  path String CODEC(ZSTD(3)),
  origin String CODEC(ZSTD(3)),
  referrer String CODEC(ZSTD(3)),
  referrerName String CODEC(ZSTD(3)),
  referrerType LowCardinality(String),
  
  -- UTM
  utmSource LowCardinality(String),
  utmMedium LowCardinality(String),
  utmCampaign LowCardinality(String),
  utmTerm String,
  utmContent String,
  
  -- Custom (Map 타입으로 네이티브 쿼리 성능 향상)
  properties Map(String, String) CODEC(ZSTD(3)),
  
  -- Session metrics (Delta 압축으로 시계열 데이터 최적화)
  duration UInt32 CODEC(Delta(4), LZ4),
  screenViews UInt32 CODEC(Delta(4), LZ4),
  
  -- Raw data
  ip Nullable(String),
  userAgent String CODEC(ZSTD(3)),
  
  -- Materialized column for dynamic filtering
  propertiesKeys Array(String) MATERIALIZED mapKeys(properties),
  
  -- Bloom Filter Indexes
  INDEX idx_name name TYPE bloom_filter GRANULARITY 1,
  INDEX idx_session sessionId TYPE bloom_filter GRANULARITY 1,
  INDEX idx_profile profileId TYPE bloom_filter GRANULARITY 1,
  INDEX idx_path path TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_referrer referrer TYPE bloom_filter(0.05) GRANULARITY 1,
  INDEX idx_origin origin TYPE bloom_filter(0.05) GRANULARITY 1,
  INDEX idx_country country TYPE bloom_filter GRANULARITY 1,
  INDEX idx_browser browser TYPE bloom_filter GRANULARITY 1,
  INDEX idx_os os TYPE bloom_filter GRANULARITY 1,
  INDEX idx_device device TYPE bloom_filter GRANULARITY 1,
  INDEX idx_utm_source utmSource TYPE bloom_filter GRANULARITY 1,
  INDEX idx_utm_campaign utmCampaign TYPE bloom_filter GRANULARITY 1,
  INDEX idx_properties_keys propertiesKeys TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
-- OpenPanel 스타일 ORDER BY: toDate 추가로 쿼리 성능 향상
ORDER BY (projectId, toDate(createdAt), profileId, name)
SETTINGS index_granularity = 8192;

-- TTL 설정 (90일 후 자동 삭제)
ALTER TABLE event_lens.events_optimized 
MODIFY TTL createdAt + INTERVAL 90 DAY;

-- ============================================================================
-- STEP 2: Profiles 테이블 최적화
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_lens.profiles_optimized (
  id String CODEC(ZSTD(3)),
  projectId String CODEC(ZSTD(3)),
  isExternal Boolean,
  
  -- User info
  firstName String CODEC(ZSTD(3)),
  lastName String CODEC(ZSTD(3)),
  email String CODEC(ZSTD(3)),
  avatar String CODEC(ZSTD(3)),
  
  -- Custom properties (Map 타입)
  properties Map(String, String) CODEC(ZSTD(3)),
  
  -- Timestamps
  createdAt DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  updatedAt DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  
  -- Bloom Filter Indexes
  INDEX idx_first_name firstName TYPE bloom_filter GRANULARITY 1,
  INDEX idx_last_name lastName TYPE bloom_filter GRANULARITY 1,
  INDEX idx_email email TYPE bloom_filter GRANULARITY 1
)
ENGINE = ReplacingMergeTree(updatedAt)
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, id)
SETTINGS index_granularity = 8192;

-- TTL 설정 (365일 후 자동 삭제)
ALTER TABLE event_lens.profiles_optimized 
MODIFY TTL createdAt + INTERVAL 365 DAY;

-- ============================================================================
-- STEP 3: Sessions 테이블 최적화
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_lens.sessions_optimized (
  sessionId String CODEC(LZ4),
  projectId String CODEC(ZSTD(3)),
  deviceId String CODEC(ZSTD(3)),
  profileId Nullable(String) CODEC(ZSTD(3)),
  
  -- Session metrics (Delta 압축)
  duration UInt32 CODEC(Delta(4), LZ4),
  screenViews UInt32 CODEC(Delta(4), LZ4),
  events UInt32 CODEC(Delta(4), LZ4),
  bounced Boolean,
  
  -- First event data
  country LowCardinality(FixedString(2)),
  city String,
  region LowCardinality(String),
  os LowCardinality(String),
  browser LowCardinality(String),
  device LowCardinality(String),
  referrer String CODEC(ZSTD(3)),
  referrerName String CODEC(ZSTD(3)),
  referrerType LowCardinality(String),
  utmSource LowCardinality(String),
  utmMedium LowCardinality(String),
  utmCampaign LowCardinality(String),
  
  -- Timestamps
  createdAt DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  endedAt Nullable(DateTime64(3)) CODEC(DoubleDelta, ZSTD(3)),
  
  -- Sign for ReplacingMergeTree
  sign Int8,
  
  -- Bloom Filter Indexes
  INDEX idx_device deviceId TYPE bloom_filter GRANULARITY 1,
  INDEX idx_profile profileId TYPE bloom_filter GRANULARITY 1
)
ENGINE = ReplacingMergeTree(createdAt, sign)
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, sessionId)
SETTINGS index_granularity = 8192;

-- TTL 설정 (90일 후 자동 삭제)
ALTER TABLE event_lens.sessions_optimized 
MODIFY TTL createdAt + INTERVAL 90 DAY;

-- ============================================================================
-- STEP 4: Materialized Views 재생성 (최적화된 테이블 기반)
-- ============================================================================

-- Daily Metrics MV
DROP TABLE IF EXISTS event_lens.daily_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.daily_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  toDate(createdAt) as date,
  uniqState(profileId) as uniqueVisitors,
  uniqState(sessionId) as uniqueSessions,
  countState() as totalEvents,
  sumState(duration) as totalDuration,
  sumState(screenViews) as totalScreenViews
FROM event_lens.events_optimized
GROUP BY projectId, date;

-- Hourly Metrics MV
DROP TABLE IF EXISTS event_lens.hourly_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.hourly_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (projectId, hour)
TTL hour + INTERVAL 90 DAY
AS SELECT
  projectId,
  toStartOfHour(createdAt) as hour,
  uniqState(profileId) as uniqueVisitors,
  uniqState(sessionId) as uniqueSessions,
  countState() as totalEvents
FROM event_lens.events_optimized
GROUP BY projectId, hour;

-- Event Name Metrics MV
DROP TABLE IF EXISTS event_lens.event_name_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.event_name_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, name, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  name,
  toDate(createdAt) as date,
  countState() as eventCount,
  uniqState(profileId) as uniqueUsers
FROM event_lens.events_optimized
GROUP BY projectId, name, date;

-- Path Metrics MV
DROP TABLE IF EXISTS event_lens.path_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.path_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, path, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  path,
  toDate(createdAt) as date,
  countState() as pageViews,
  uniqState(sessionId) as uniqueSessions
FROM event_lens.events_optimized
WHERE path != ''
GROUP BY projectId, path, date;

-- Referrer Metrics MV
DROP TABLE IF EXISTS event_lens.referrer_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.referrer_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, referrer, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  referrer,
  referrerName,
  referrerType,
  toDate(createdAt) as date,
  countState() as visits,
  uniqState(sessionId) as uniqueSessions
FROM event_lens.events_optimized
WHERE referrer != ''
GROUP BY projectId, referrer, referrerName, referrerType, date;

-- Device Metrics MV
DROP TABLE IF EXISTS event_lens.device_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.device_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, os, browser, device, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  os,
  browser,
  device,
  toDate(createdAt) as date,
  countState() as events,
  uniqState(sessionId) as uniqueSessions
FROM event_lens.events_optimized
GROUP BY projectId, os, browser, device, date;

-- Geo Metrics MV
DROP TABLE IF EXISTS event_lens.geo_metrics_optimized;
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.geo_metrics_optimized
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, country, city, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  projectId,
  country,
  city,
  region,
  toDate(createdAt) as date,
  countState() as events,
  uniqState(sessionId) as uniqueSessions
FROM event_lens.events_optimized
GROUP BY projectId, country, city, region, date;

-- ============================================================================
-- STEP 5: 데이터 마이그레이션 가이드
-- ============================================================================

-- 주의: 실제 데이터 마이그레이션은 다운타임이 필요합니다.
-- 아래 쿼리는 참고용이며, 실제 운영 환경에서는 단계적으로 진행해야 합니다.

-- 1. 기존 데이터를 새 테이블로 복사 (properties를 Map으로 변환)
-- INSERT INTO event_lens.events_optimized
-- SELECT
--   id,
--   projectId,
--   name,
--   deviceId,
--   profileId,
--   sessionId,
--   createdAt,
--   timestamp,
--   country,
--   city,
--   region,
--   latitude,
--   longitude,
--   os,
--   osVersion,
--   browser,
--   browserVersion,
--   device,
--   brand,
--   model,
--   path,
--   origin,
--   referrer,
--   referrerName,
--   referrerType,
--   utmSource,
--   utmMedium,
--   utmCampaign,
--   utmTerm,
--   utmContent,
--   CAST(JSONExtractKeysAndValues(properties, 'String'), 'Map(String, String)') as properties,
--   duration,
--   screenViews,
--   ip,
--   userAgent
-- FROM event_lens.events;

-- 2. 테이블 교체
-- RENAME TABLE event_lens.events TO event_lens.events_old;
-- RENAME TABLE event_lens.events_optimized TO event_lens.events;

-- 3. 기존 테이블 삭제 (확인 후)
-- DROP TABLE event_lens.events_old;

