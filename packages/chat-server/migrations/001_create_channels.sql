-- 채널 테이블 (채팅방)
CREATE TABLE IF NOT EXISTS chat_channels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('public', 'private', 'direct') NOT NULL DEFAULT 'public',
  
  -- 채널 설정
  max_members INT UNSIGNED DEFAULT 1000,
  is_archived BOOLEAN DEFAULT FALSE,
  archive_reason TEXT,
  
  -- 메타데이터
  avatar_url VARCHAR(500),
  settings JSON, -- 채널별 설정 (알림, 권한 등)
  
  -- 소유자 및 생성 정보
  owner_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED,
  
  -- 타임스탬프
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  
  -- 인덱스
  INDEX idx_channels_type (type),
  INDEX idx_channels_owner (owner_id),
  INDEX idx_channels_created_at (created_at),
  INDEX idx_channels_active (is_archived, type),
  
  -- 전문 검색 인덱스
  FULLTEXT idx_channels_search (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 채널 멤버십 테이블 (샤딩 고려)
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  
  -- 멤버 역할 및 권한
  role ENUM('owner', 'admin', 'moderator', 'member') DEFAULT 'member',
  permissions JSON, -- 세부 권한 설정
  
  -- 멤버 상태
  status ENUM('active', 'muted', 'banned', 'left') DEFAULT 'active',
  muted_until TIMESTAMP NULL,
  ban_reason TEXT,
  
  -- 읽기 상태 (성능 최적화)
  last_read_message_id BIGINT UNSIGNED DEFAULT 0,
  last_read_at TIMESTAMP NULL,
  unread_count INT UNSIGNED DEFAULT 0,
  
  -- 알림 설정
  notification_settings JSON,
  
  -- 타임스탬프
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 제약 조건
  UNIQUE KEY uk_channel_user (channel_id, user_id),
  
  -- 인덱스 (성능 최적화)
  INDEX idx_members_channel (channel_id, status),
  INDEX idx_members_user (user_id, status),
  INDEX idx_members_unread (user_id, unread_count),
  INDEX idx_members_last_read (channel_id, last_read_message_id),
  
  -- 파티셔닝을 위한 인덱스
  INDEX idx_members_partition (channel_id, user_id, joined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- 샤딩을 위한 파티셔닝 (채널 ID 기준)
PARTITION BY HASH(channel_id) PARTITIONS 16;
