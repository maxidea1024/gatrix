-- User profiles materialized view for Product Analytics
-- Aggregates per-user summary from argus.activities table
-- Used by: User Profiles page, Cohort membership display

CREATE MATERIALIZED VIEW IF NOT EXISTS argus.user_profiles_mv
ENGINE = AggregatingMergeTree()
PARTITION BY project_id
ORDER BY (project_id, user_id)
AS SELECT
    project_id,
    user_id,
    minState(timestamp)           AS first_seen,
    maxState(timestamp)           AS last_seen,
    countState()                  AS total_events,
    uniqExactState(event_name)    AS unique_events,
    uniqExactState(session_id)    AS total_sessions,
    anyLastState(platform)        AS last_platform,
    anyLastState(country)         AS last_country,
    anyLastState(os)              AS last_os,
    anyLastState(app_version)     AS last_app_version,
    anyLastState(device_id)       AS last_device_id
FROM argus.activities
WHERE user_id != ''
GROUP BY project_id, user_id;
