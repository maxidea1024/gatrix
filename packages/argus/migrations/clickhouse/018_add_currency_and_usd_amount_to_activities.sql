ALTER TABLE argus.activities ADD COLUMN IF NOT EXISTS currency Nullable(String) CODEC(ZSTD(3));
ALTER TABLE argus.activities ADD COLUMN IF NOT EXISTS amount_usd Nullable(Float64) CODEC(ZSTD(3));

-- 소급 적용 (Retroactive migration for existing events)
ALTER TABLE argus.activities UPDATE amount_usd = numeric_properties['amount'] WHERE isNull(amount_usd);
ALTER TABLE argus.activities UPDATE currency = 'USD' WHERE isNull(currency) OR currency = '';
