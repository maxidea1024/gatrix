-- Activities table for Product Analytics
-- Stores user behavior events (e.g., 'user_login', 'item_purchased')
-- Used by: Insights, Funnels, Retention, Flows

CREATE TABLE IF NOT EXISTS argus.activities (
    event_id         FixedString(32),
    project_id       String,
    timestamp        DateTime64(3),

    -- Core event fields
    event_name       String,

    -- User identification (critical for Funnel/Retention/Flows)
    user_id          String,
    device_id        String         DEFAULT '',
    session_id       String         DEFAULT '',

    -- Context
    platform         LowCardinality(String),
    environment      LowCardinality(String),
    release          LowCardinality(String),

    -- GeoIP (derived server-side from IP, IP itself is NOT stored)
    country          LowCardinality(String) DEFAULT '',
    city             LowCardinality(String) DEFAULT '',

    -- Device / App context
    os               LowCardinality(String) DEFAULT '',
    app_version      LowCardinality(String) DEFAULT '',

    -- Flexible properties
    properties       Map(String, String),
    numeric_properties Map(String, Float64),

    -- Ingestion metadata
    received_at      DateTime64(3)  DEFAULT now64(3),

    -- DSN key tracking
    dsn_key_id       UInt32         DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, event_name, timestamp, user_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
