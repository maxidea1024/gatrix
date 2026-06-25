-- ============================================================================
-- Backfill argus.profiles from existing argus.activities data
-- Run ONCE after creating the profiles table (016_create_profiles_table.sql)
-- ============================================================================

INSERT INTO argus.profiles (
  project_id,
  user_id,
  avatar_url,
  email,
  first_name,
  last_name,
  properties,
  updated_at
)
SELECT
  project_id,
  user_id,
  anyLast(properties['avatar_url'])  AS avatar_url,
  anyLast(properties['email'])       AS email,
  anyLast(properties['first_name'])  AS first_name,
  anyLast(properties['last_name'])   AS last_name,
  CAST(map() AS Map(String, String))   AS properties,
  max(timestamp)                     AS updated_at
FROM argus.activities
WHERE user_id != ''
  AND (
    properties['avatar_url'] != ''
    OR properties['email'] != ''
    OR properties['first_name'] != ''
    OR properties['last_name'] != ''
  )
GROUP BY project_id, user_id;
