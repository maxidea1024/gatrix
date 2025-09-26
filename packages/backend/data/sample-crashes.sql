-- Sample crash data for testing client crash tracking system
-- This file creates sample crash data to test the crash tracking functionality

USE uwo_gate;

-- Insert sample crashes
INSERT INTO crashes (
  crash_id, user_id, user_nickname, platform, branch, market_type, server_group, 
  device_type, version, crash_type, crash_message, stack_trace_file, logs_file, 
  state, first_occurred_at, last_occurred_at, occurrence_count
) VALUES 
(
  'crash_001_nullpointer', 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server',
  'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 
  'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference',
  '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt',
  '/crashes/2025/09/26/crash_001_nullpointer_logs.txt',
  0, '2025-09-26 10:30:00', '2025-09-26 15:45:00', 5
),
(
  'crash_002_outofmemory', 2, 'testuser2', 'ios', 'release', 'app_store', 'us_server',
  'iPhone 14 Pro', '1.2.3', 'OutOfMemoryError',
  'Fatal Exception: OutOfMemoryError: Failed to allocate memory for texture',
  '/crashes/2025/09/26/crash_002_outofmemory_stacktrace.txt',
  '/crashes/2025/09/26/crash_002_outofmemory_logs.txt',
  0, '2025-09-26 11:15:00', '2025-09-26 14:20:00', 3
),
(
  'crash_003_network', 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server',
  'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException',
  'java.net.SocketTimeoutException: timeout',
  '/crashes/2025/09/26/crash_003_network_stacktrace.txt',
  '/crashes/2025/09/26/crash_003_network_logs.txt',
  0, '2025-09-26 12:00:00', '2025-09-26 16:00:00', 8
),
(
  'crash_004_indexoutofbounds', 4, 'testuser4', 'android', 'beta', 'xiaomi', 'jp_server',
  'Xiaomi Mi 12', '1.3.0-beta2', 'IndexOutOfBoundsException',
  'java.lang.IndexOutOfBoundsException: Index: 5, Size: 3',
  '/crashes/2025/09/26/crash_004_indexoutofbounds_stacktrace.txt',
  '/crashes/2025/09/26/crash_004_indexoutofbounds_logs.txt',
  1, '2025-09-26 09:30:00', '2025-09-26 13:15:00', 2
),
(
  'crash_005_segfault', 5, 'testuser5', 'windows', 'dev', NULL, 'eu_server',
  'Windows 11 x64', '1.4.0-dev', 'SegmentationFault',
  'Access violation reading location 0x00000000',
  '/crashes/2025/09/26/crash_005_segfault_stacktrace.txt',
  '/crashes/2025/09/26/crash_005_segfault_logs.txt',
  0, '2025-09-26 13:45:00', '2025-09-26 15:30:00', 1
);

-- Insert corresponding crash instances
INSERT INTO crash_instances (
  cid, user_id, user_nickname, platform, branch, market_type, server_group,
  device_type, version, crash_type, crash_message, stack_trace_file, logs_file, occurred_at
) VALUES 
-- Instances for crash_001_nullpointer (5 occurrences)
(1, 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server', 'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference', '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt', '/crashes/2025/09/26/crash_001_nullpointer_logs.txt', '2025-09-26 10:30:00'),
(1, 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server', 'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference', '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt', '/crashes/2025/09/26/crash_001_nullpointer_logs.txt', '2025-09-26 11:45:00'),
(1, 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server', 'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference', '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt', '/crashes/2025/09/26/crash_001_nullpointer_logs.txt', '2025-09-26 13:20:00'),
(1, 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server', 'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference', '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt', '/crashes/2025/09/26/crash_001_nullpointer_logs.txt', '2025-09-26 14:10:00'),
(1, 1, 'testuser1', 'android', 'release', 'google_play', 'kr_server', 'Samsung Galaxy S21', '1.2.3', 'NullPointerException', 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference', '/crashes/2025/09/26/crash_001_nullpointer_stacktrace.txt', '/crashes/2025/09/26/crash_001_nullpointer_logs.txt', '2025-09-26 15:45:00'),

-- Instances for crash_002_outofmemory (3 occurrences)
(2, 2, 'testuser2', 'ios', 'release', 'app_store', 'us_server', 'iPhone 14 Pro', '1.2.3', 'OutOfMemoryError', 'Fatal Exception: OutOfMemoryError: Failed to allocate memory for texture', '/crashes/2025/09/26/crash_002_outofmemory_stacktrace.txt', '/crashes/2025/09/26/crash_002_outofmemory_logs.txt', '2025-09-26 11:15:00'),
(2, 2, 'testuser2', 'ios', 'release', 'app_store', 'us_server', 'iPhone 14 Pro', '1.2.3', 'OutOfMemoryError', 'Fatal Exception: OutOfMemoryError: Failed to allocate memory for texture', '/crashes/2025/09/26/crash_002_outofmemory_stacktrace.txt', '/crashes/2025/09/26/crash_002_outofmemory_logs.txt', '2025-09-26 12:30:00'),
(2, 2, 'testuser2', 'ios', 'release', 'app_store', 'us_server', 'iPhone 14 Pro', '1.2.3', 'OutOfMemoryError', 'Fatal Exception: OutOfMemoryError: Failed to allocate memory for texture', '/crashes/2025/09/26/crash_002_outofmemory_stacktrace.txt', '/crashes/2025/09/26/crash_002_outofmemory_logs.txt', '2025-09-26 14:20:00'),

-- Instances for crash_003_network (8 occurrences)
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 12:00:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 12:30:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 13:15:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 14:00:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 14:45:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 15:20:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 15:50:00'),
(3, 3, 'testuser3', 'android', 'patch', 'huawei', 'cn_server', 'Huawei P50 Pro', '1.2.4-patch1', 'NetworkException', 'java.net.SocketTimeoutException: timeout', '/crashes/2025/09/26/crash_003_network_stacktrace.txt', '/crashes/2025/09/26/crash_003_network_logs.txt', '2025-09-26 16:00:00'),

-- Instances for crash_004_indexoutofbounds (2 occurrences)
(4, 4, 'testuser4', 'android', 'beta', 'xiaomi', 'jp_server', 'Xiaomi Mi 12', '1.3.0-beta2', 'IndexOutOfBoundsException', 'java.lang.IndexOutOfBoundsException: Index: 5, Size: 3', '/crashes/2025/09/26/crash_004_indexoutofbounds_stacktrace.txt', '/crashes/2025/09/26/crash_004_indexoutofbounds_logs.txt', '2025-09-26 09:30:00'),
(4, 4, 'testuser4', 'android', 'beta', 'xiaomi', 'jp_server', 'Xiaomi Mi 12', '1.3.0-beta2', 'IndexOutOfBoundsException', 'java.lang.IndexOutOfBoundsException: Index: 5, Size: 3', '/crashes/2025/09/26/crash_004_indexoutofbounds_stacktrace.txt', '/crashes/2025/09/26/crash_004_indexoutofbounds_logs.txt', '2025-09-26 13:15:00'),

-- Instance for crash_005_segfault (1 occurrence)
(5, 5, 'testuser5', 'windows', 'dev', NULL, 'eu_server', 'Windows 11 x64', '1.4.0-dev', 'SegmentationFault', 'Access violation reading location 0x00000000', '/crashes/2025/09/26/crash_005_segfault_stacktrace.txt', '/crashes/2025/09/26/crash_005_segfault_logs.txt', '2025-09-26 13:45:00');

SELECT 'Sample crash data inserted successfully' AS Message;
SELECT COUNT(*) AS 'Total Crashes' FROM crashes;
SELECT COUNT(*) AS 'Total Crash Instances' FROM crash_instances;
