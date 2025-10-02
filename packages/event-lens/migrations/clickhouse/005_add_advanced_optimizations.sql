-- Advanced ClickHouse Optimizations

-- 1. TTL 설정 (90일 후 자동 삭제)
ALTER TABLE event_lens.events 
MODIFY TTL createdAt + INTERVAL 90 DAY;

-- 2. 컬럼 레벨 압축 (ZSTD)
ALTER TABLE event_lens.events 
MODIFY COLUMN properties String CODEC(ZSTD(3));

ALTER TABLE event_lens.events 
MODIFY COLUMN userAgent String CODEC(ZSTD(3));

-- 3. 추가 Bloom Filter 인덱스
ALTER TABLE event_lens.events 
ADD INDEX idx_path path TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_referrer referrer TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_country country TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_browser browser TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_os os TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_device device TYPE bloom_filter GRANULARITY 1;

-- 4. UTM 파라미터 인덱스
ALTER TABLE event_lens.events 
ADD INDEX idx_utm_source utmSource TYPE bloom_filter GRANULARITY 1;

ALTER TABLE event_lens.events 
ADD INDEX idx_utm_campaign utmCampaign TYPE bloom_filter GRANULARITY 1;

-- 5. Properties JSON 키 추출을 위한 Materialized Column
-- (동적 필터링 성능 향상)
ALTER TABLE event_lens.events 
ADD COLUMN IF NOT EXISTS propertiesKeys Array(String) 
MATERIALIZED JSONExtractKeys(properties);

ALTER TABLE event_lens.events 
ADD INDEX idx_properties_keys propertiesKeys TYPE bloom_filter(0.01) GRANULARITY 1;

-- 6. 이벤트 이름별 집계 Materialized View
CREATE TABLE IF NOT EXISTS event_lens.event_name_metrics (
  projectId String,
  name String,
  date Date,
  totalCount AggregateFunction(count),
  uniqueDevices AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, name, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.event_name_metrics_mv
TO event_lens.event_name_metrics
AS SELECT
  projectId,
  name,
  toDate(createdAt) as date,
  countState() as totalCount,
  uniqState(deviceId) as uniqueDevices
FROM event_lens.events
GROUP BY projectId, name, date;

-- 7. 경로별 집계 Materialized View
CREATE TABLE IF NOT EXISTS event_lens.path_metrics (
  projectId String,
  path String,
  date Date,
  views AggregateFunction(count),
  uniqueVisitors AggregateFunction(uniq, String),
  avgDuration AggregateFunction(avg, UInt32)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, path, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.path_metrics_mv
TO event_lens.path_metrics
AS SELECT
  projectId,
  path,
  toDate(createdAt) as date,
  countState() as views,
  uniqState(deviceId) as uniqueVisitors,
  avgState(duration) as avgDuration
FROM event_lens.events
WHERE name = 'screen_view' AND path IS NOT NULL
GROUP BY projectId, path, date;

-- 8. Referrer별 집계 Materialized View
CREATE TABLE IF NOT EXISTS event_lens.referrer_metrics (
  projectId String,
  referrerName String,
  referrerType String,
  date Date,
  visits AggregateFunction(count),
  uniqueVisitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, referrerName, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.referrer_metrics_mv
TO event_lens.referrer_metrics
AS SELECT
  projectId,
  referrerName,
  referrerType,
  toDate(createdAt) as date,
  countState() as visits,
  uniqState(deviceId) as uniqueVisitors
FROM event_lens.events
WHERE referrerName IS NOT NULL
GROUP BY projectId, referrerName, referrerType, date;

-- 9. 디바이스별 집계 Materialized View
CREATE TABLE IF NOT EXISTS event_lens.device_metrics (
  projectId String,
  device String,
  browser String,
  os String,
  date Date,
  count AggregateFunction(count),
  uniqueVisitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, device, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.device_metrics_mv
TO event_lens.device_metrics
AS SELECT
  projectId,
  device,
  browser,
  os,
  toDate(createdAt) as date,
  countState() as count,
  uniqState(deviceId) as uniqueVisitors
FROM event_lens.events
GROUP BY projectId, device, browser, os, date;

-- 10. 지리별 집계 Materialized View
CREATE TABLE IF NOT EXISTS event_lens.geo_metrics (
  projectId String,
  country String,
  city String,
  date Date,
  count AggregateFunction(count),
  uniqueVisitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, country, date)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.geo_metrics_mv
TO event_lens.geo_metrics
AS SELECT
  projectId,
  country,
  city,
  toDate(createdAt) as date,
  countState() as count,
  uniqState(deviceId) as uniqueVisitors
FROM event_lens.events
WHERE country IS NOT NULL
GROUP BY projectId, country, city, date;

-- 11. 세션 테이블 TTL
ALTER TABLE event_lens.sessions 
MODIFY TTL createdAt + INTERVAL 90 DAY;

-- 12. 프로필 테이블 최적화
ALTER TABLE event_lens.profiles 
MODIFY COLUMN properties String CODEC(ZSTD(3));

-- 13. Materialized View TTL
ALTER TABLE event_lens.daily_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

ALTER TABLE event_lens.hourly_metrics 
MODIFY TTL hour + INTERVAL 90 DAY;

ALTER TABLE event_lens.event_name_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

ALTER TABLE event_lens.path_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

ALTER TABLE event_lens.referrer_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

ALTER TABLE event_lens.device_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

ALTER TABLE event_lens.geo_metrics 
MODIFY TTL date + INTERVAL 365 DAY;

