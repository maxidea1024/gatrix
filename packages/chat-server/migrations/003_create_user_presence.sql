-- 사용자 온라인 상태 테이블 (고성능)
CREATE TABLE IF NOT EXISTS chat_user_presence (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  
  -- 온라인 상태
  status ENUM('online', 'away', 'busy', 'offline') DEFAULT 'offline',
  custom_status VARCHAR(255) NULL,
  
  -- 연결 정보
  socket_id VARCHAR(100) NULL,
  server_id VARCHAR(100) NULL,
  device_type ENUM('web', 'mobile', 'desktop') DEFAULT 'web',
  user_agent TEXT NULL,
  ip_address VARCHAR(45) NULL,
  
  -- 타임스탬프
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_presence_status (status, last_seen_at),
  INDEX idx_presence_server (server_id),
  INDEX idx_presence_last_seen (last_seen_at)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 타이핑 인디케이터 테이블 (임시 데이터, 메모리 엔진)
CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- 제약 조건
  UNIQUE KEY uk_channel_user_typing (channel_id, user_id),
  
  -- 인덱스
  INDEX idx_typing_channel (channel_id, expires_at),
  INDEX idx_typing_expires (expires_at)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 차단 테이블
CREATE TABLE IF NOT EXISTS chat_user_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  blocker_user_id BIGINT UNSIGNED NOT NULL,
  blocked_user_id BIGINT UNSIGNED NOT NULL,
  
  reason VARCHAR(255) NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 제약 조건
  UNIQUE KEY uk_blocker_blocked (blocker_user_id, blocked_user_id),
  
  -- 인덱스
  INDEX idx_blocks_blocker (blocker_user_id),
  INDEX idx_blocks_blocked (blocked_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 알림 테이블
CREATE TABLE IF NOT EXISTS chat_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  
  -- 알림 내용
  type ENUM('message', 'mention', 'channel_invite', 'system') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  
  -- 관련 엔티티
  channel_id BIGINT UNSIGNED NULL,
  message_id BIGINT UNSIGNED NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  
  -- 알림 상태
  is_read BOOLEAN DEFAULT FALSE,
  is_delivered BOOLEAN DEFAULT FALSE,
  delivery_method ENUM('push', 'email', 'sms', 'in_app') DEFAULT 'in_app',
  
  -- 메타데이터
  metadata JSON,
  
  -- 타임스탬프
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  
  -- 인덱스
  INDEX idx_notifications_user (user_id, is_read, created_at DESC),
  INDEX idx_notifications_channel (channel_id),
  INDEX idx_notifications_message (message_id),
  INDEX idx_notifications_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- 시간 기반 파티셔닝 (월별)
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
  PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  PARTITION p202403 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
  PARTITION p202404 VALUES LESS THAN (UNIX_TIMESTAMP('2024-05-01')),
  PARTITION p202405 VALUES LESS THAN (UNIX_TIMESTAMP('2024-06-01')),
  PARTITION p202406 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
  PARTITION p202407 VALUES LESS THAN (UNIX_TIMESTAMP('2024-08-01')),
  PARTITION p202408 VALUES LESS THAN (UNIX_TIMESTAMP('2024-09-01')),
  PARTITION p202409 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
  PARTITION p202410 VALUES LESS THAN (UNIX_TIMESTAMP('2024-11-01')),
  PARTITION p202411 VALUES LESS THAN (UNIX_TIMESTAMP('2024-12-01')),
  PARTITION p202412 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
