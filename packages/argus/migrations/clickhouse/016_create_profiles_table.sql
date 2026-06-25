-- ============================================================================
-- Profiles table for user profile data (avatar, email, etc.)
-- Replaces costly anyLast() scans on argus.activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS argus.profiles (
  `project_id`    String        CODEC(ZSTD(3)),
  `user_id`       String        CODEC(ZSTD(3)),
  `avatar_url`    String        CODEC(ZSTD(3)),
  `email`         String        CODEC(ZSTD(3)),
  `first_name`    String        CODEC(ZSTD(3)),
  `last_name`     String        CODEC(ZSTD(3)),
  `properties`    Map(String, String) CODEC(ZSTD(3)),
  `updated_at`    DateTime64(3) CODEC(Delta(4), LZ4),

  INDEX idx_email email TYPE bloom_filter GRANULARITY 1
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (project_id, user_id)
SETTINGS index_granularity = 8192;
