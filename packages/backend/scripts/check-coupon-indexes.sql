-- Check indexes on g_coupons table
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_NAME = 'g_coupons'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check query performance for large offset
-- This simulates what happens when user navigates to page 500000 (offset 10000000)
EXPLAIN SELECT id, settingId, code, status, createdAt, usedAt 
FROM g_coupons 
WHERE settingId = '01K8MZJHCSVKED0ZB4RJ11TVD8'
ORDER BY createdAt DESC 
LIMIT 20 OFFSET 0;

-- Check with large offset
EXPLAIN SELECT id, settingId, code, status, createdAt, usedAt 
FROM g_coupons 
WHERE settingId = '01K8MZJHCSVKED0ZB4RJ11TVD8'
ORDER BY createdAt DESC 
LIMIT 20 OFFSET 1000000;

-- Check table statistics
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  AVG_ROW_LENGTH,
  DATA_LENGTH,
  INDEX_LENGTH
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'g_coupons';

