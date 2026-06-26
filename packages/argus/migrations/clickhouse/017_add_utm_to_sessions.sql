ALTER TABLE argus.sessions ADD COLUMN IF NOT EXISTS utm_source Nullable(String) CODEC(ZSTD(3));
ALTER TABLE argus.sessions ADD COLUMN IF NOT EXISTS utm_medium Nullable(String) CODEC(ZSTD(3));
ALTER TABLE argus.sessions ADD COLUMN IF NOT EXISTS utm_campaign Nullable(String) CODEC(ZSTD(3));
ALTER TABLE argus.sessions ADD COLUMN IF NOT EXISTS utm_term Nullable(String) CODEC(ZSTD(3));
ALTER TABLE argus.sessions ADD COLUMN IF NOT EXISTS utm_content Nullable(String) CODEC(ZSTD(3));
