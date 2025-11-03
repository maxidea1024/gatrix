-- Advanced ClickHouse Optimizations

-- 1. 컬럼 레벨 압축 (ZSTD)
ALTER TABLE event_lens.events
MODIFY COLUMN properties String CODEC(ZSTD(3));

-- 2. 추가 Bloom Filter 인덱스 (이미 001에서 생성됨)
-- 인덱스는 테이블 생성 시 이미 추가되었습니다

-- 3. 이벤트 이름별 집계 Materialized View
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
  project_id as projectId,
  name,
  toDate(created_at) as date,
  countState() as totalCount,
  uniqState(device_id) as uniqueDevices
FROM event_lens.events
GROUP BY project_id, name, toDate(created_at);

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
  project_id as projectId,
  path,
  toDate(created_at) as date,
  countState() as views,
  uniqState(device_id) as uniqueVisitors,
  avgState(duration) as avgDuration
FROM event_lens.events
WHERE name = 'screen_view' AND path IS NOT NULL
GROUP BY project_id, path, toDate(created_at);

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
  project_id as projectId,
  referrer_name as referrerName,
  referrer_type as referrerType,
  toDate(created_at) as date,
  countState() as visits,
  uniqState(device_id) as uniqueVisitors
FROM event_lens.events
WHERE referrer_name IS NOT NULL
GROUP BY project_id, referrer_name, referrer_type, toDate(created_at);

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
  project_id as projectId,
  device,
  browser,
  os,
  toDate(created_at) as date,
  countState() as count,
  uniqState(device_id) as uniqueVisitors
FROM event_lens.events
GROUP BY project_id, device, browser, os, toDate(created_at);

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
  project_id as projectId,
  country,
  city,
  toDate(created_at) as date,
  countState() as count,
  uniqState(device_id) as uniqueVisitors
FROM event_lens.events
WHERE country IS NOT NULL
GROUP BY project_id, country, city, toDate(created_at);

-- 11. 프로필 테이블 최적화
ALTER TABLE event_lens.profiles
MODIFY COLUMN properties String CODEC(ZSTD(3));

-- TTL 설정은 DateTime64 타입에서 지원되지 않으므로 생략
-- TTL이 필요한 경우 별도의 DateTime 컬럼을 추가하거나 파티션 정책 사용

