-- 메시지 테이블 (고성능 샤딩)
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  
  -- 메시지 내용
  content TEXT NOT NULL,
  content_type ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'system') DEFAULT 'text',
  
  -- 메시지 메타데이터
  message_data JSON, -- 첨부파일, 멘션, 해시태그, 이모지 등
  reply_to_message_id BIGINT UNSIGNED NULL, -- 답글
  thread_id BIGINT UNSIGNED NULL, -- 스레드
  
  -- 메시지 상태
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- 시스템 메시지 정보
  system_message_type VARCHAR(50) NULL, -- user_joined, user_left, channel_created 등
  system_message_data JSON,
  
  -- 타임스탬프
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3), -- 밀리초 정밀도
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at TIMESTAMP(3) NULL,
  
  -- 인덱스 (성능 최적화)
  INDEX idx_messages_channel_time (channel_id, created_at DESC),
  INDEX idx_messages_user (user_id, created_at DESC),
  INDEX idx_messages_reply (reply_to_message_id),
  INDEX idx_messages_thread (thread_id, created_at),
  INDEX idx_messages_active (channel_id, is_deleted, created_at DESC),
  
  -- 전문 검색 인덱스
  FULLTEXT idx_messages_content (content)
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

-- 메시지 첨부파일 테이블
CREATE TABLE IF NOT EXISTS chat_message_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  
  -- 파일 정보
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- 이미지/비디오 메타데이터
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  duration INT UNSIGNED NULL, -- 초 단위
  
  -- 썸네일
  thumbnail_path VARCHAR(500) NULL,
  thumbnail_width INT UNSIGNED NULL,
  thumbnail_height INT UNSIGNED NULL,
  
  -- 업로드 정보
  upload_status ENUM('uploading', 'completed', 'failed') DEFAULT 'uploading',
  upload_progress TINYINT UNSIGNED DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_attachments_message (message_id),
  INDEX idx_attachments_type (file_type),
  INDEX idx_attachments_status (upload_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 메시지 반응 테이블 (이모지 반응)
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  emoji VARCHAR(50) NOT NULL, -- 이모지 유니코드 또는 커스텀 이모지 ID
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 제약 조건 (한 사용자는 메시지당 같은 이모지 하나만)
  UNIQUE KEY uk_message_user_emoji (message_id, user_id, emoji),
  
  -- 인덱스
  INDEX idx_reactions_message (message_id),
  INDEX idx_reactions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
