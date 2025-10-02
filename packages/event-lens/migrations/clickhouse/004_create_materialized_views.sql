-- ============================================================================
-- Materialized Views (OpenPanel 스타일)
-- ============================================================================

-- DAU (Daily Active Users) Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.dau_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(date)
ORDER BY (project_id, date)
TTL date + INTERVAL 365 DAY
AS SELECT
  toDate(created_at) as date,
  uniqState(profile_id) as profile_id,
  project_id
FROM event_lens.events
GROUP BY date, project_id;

-- Distinct Event Names Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.distinct_event_names_mv
ENGINE = AggregatingMergeTree()
ORDER BY (project_id, name, created_at)
AS SELECT
  project_id,
  name,
  max(created_at) AS created_at,
  count() AS event_count
FROM event_lens.events
GROUP BY project_id, name;

-- Event Property Values Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS event_lens.event_property_values_mv
ENGINE = AggregatingMergeTree()
ORDER BY (project_id, name, property_key, property_value)
AS SELECT
  project_id,
  name,
  key_value.1 as property_key,
  key_value.2 as property_value,
  created_at
FROM (
  SELECT
    project_id,
    name,
    arrayJoin(mapItems(properties)) as key_value,
    max(created_at) as created_at
  FROM event_lens.events
  GROUP BY project_id, name, key_value
)
WHERE property_value != ''
  AND property_key != ''
GROUP BY project_id, name, property_key, property_value, created_at;

