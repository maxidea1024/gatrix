-- 메시지 검색 최적화를 위한 인덱스 테이블
CREATE TABLE IF NOT EXISTS chat_message_search_index (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  channel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  
  -- 검색 최적화된 컨텐츠
  search_content TEXT NOT NULL, -- 정규화된 검색 텍스트
  keywords VARCHAR(1000), -- 추출된 키워드
  mentions JSON, -- 멘션된 사용자 ID 배열
  hashtags JSON, -- 해시태그 배열
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_search_channel (channel_id),
  INDEX idx_search_user (user_id),
  INDEX idx_search_message (message_id),
  
  -- 전문 검색 인덱스
  FULLTEXT idx_search_content (search_content, keywords)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 채널 통계 테이블 (성능 최적화)
CREATE TABLE IF NOT EXISTS chat_channel_stats (
  channel_id BIGINT UNSIGNED PRIMARY KEY,
  
  -- 멤버 통계
  total_members INT UNSIGNED DEFAULT 0,
  active_members INT UNSIGNED DEFAULT 0, -- 최근 7일 활성 멤버
  online_members INT UNSIGNED DEFAULT 0,
  
  -- 메시지 통계
  total_messages BIGINT UNSIGNED DEFAULT 0,
  messages_today INT UNSIGNED DEFAULT 0,
  messages_this_week INT UNSIGNED DEFAULT 0,
  messages_this_month INT UNSIGNED DEFAULT 0,
  
  -- 활동 통계
  last_message_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NULL,
  peak_concurrent_users INT UNSIGNED DEFAULT 0,
  
  -- 업데이트 타임스탬프
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_stats_activity (last_activity_at),
  INDEX idx_stats_messages (total_messages),
  INDEX idx_stats_members (total_members)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 통계 테이블
CREATE TABLE IF NOT EXISTS chat_user_stats (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  
  -- 메시지 통계
  total_messages_sent BIGINT UNSIGNED DEFAULT 0,
  messages_today INT UNSIGNED DEFAULT 0,
  messages_this_week INT UNSIGNED DEFAULT 0,
  messages_this_month INT UNSIGNED DEFAULT 0,
  
  -- 채널 통계
  total_channels_joined INT UNSIGNED DEFAULT 0,
  active_channels INT UNSIGNED DEFAULT 0, -- 최근 활동한 채널 수
  
  -- 활동 통계
  first_message_at TIMESTAMP NULL,
  last_message_at TIMESTAMP NULL,
  total_online_time BIGINT UNSIGNED DEFAULT 0, -- 초 단위
  
  -- 업데이트 타임스탬프
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_user_stats_activity (last_message_at),
  INDEX idx_user_stats_messages (total_messages_sent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 서버 성능 모니터링 테이블
CREATE TABLE IF NOT EXISTS chat_server_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(100) NOT NULL,
  
  -- 연결 통계
  concurrent_connections INT UNSIGNED DEFAULT 0,
  total_connections_today BIGINT UNSIGNED DEFAULT 0,
  peak_connections INT UNSIGNED DEFAULT 0,
  
  -- 메시지 통계
  messages_per_second DECIMAL(10,2) DEFAULT 0,
  total_messages_processed BIGINT UNSIGNED DEFAULT 0,
  
  -- 성능 지표
  cpu_usage DECIMAL(5,2) DEFAULT 0, -- 퍼센트
  memory_usage BIGINT UNSIGNED DEFAULT 0, -- 바이트
  redis_latency DECIMAL(10,3) DEFAULT 0, -- 밀리초
  db_latency DECIMAL(10,3) DEFAULT 0, -- 밀리초
  
  -- 에러 통계
  error_count INT UNSIGNED DEFAULT 0,
  warning_count INT UNSIGNED DEFAULT 0,
  
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_metrics_server (server_id, recorded_at),
  INDEX idx_metrics_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- 시간 기반 파티셔닝 (일별)
PARTITION BY RANGE (UNIX_TIMESTAMP(recorded_at)) (
  PARTITION p_day1 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY))),
  PARTITION p_day2 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY))),
  PARTITION p_day3 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 3 DAY))),
  PARTITION p_day4 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY))),
  PARTITION p_day5 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 5 DAY))),
  PARTITION p_day6 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 6 DAY))),
  PARTITION p_day7 VALUES LESS THAN (UNIX_TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 7 DAY))),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 메시지 큐 테이블 (배치 처리용)
CREATE TABLE IF NOT EXISTS chat_message_queue (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  
  -- 큐 정보
  queue_type ENUM('broadcast', 'notification', 'webhook', 'analytics') NOT NULL,
  priority TINYINT UNSIGNED DEFAULT 5, -- 1(높음) ~ 10(낮음)
  
  -- 메시지 데이터
  payload JSON NOT NULL,
  target_channels JSON, -- 대상 채널 ID 배열
  target_users JSON, -- 대상 사용자 ID 배열
  
  -- 처리 상태
  status ENUM('pending', 'processing', 'completed', 'failed', 'retrying') DEFAULT 'pending',
  attempts INT UNSIGNED DEFAULT 0,
  max_attempts INT UNSIGNED DEFAULT 3,
  
  -- 스케줄링
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  
  -- 에러 정보
  error_message TEXT NULL,
  error_details JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_queue_status (status, priority, scheduled_at),
  INDEX idx_queue_type (queue_type, status),
  INDEX idx_queue_scheduled (scheduled_at),
  INDEX idx_queue_cleanup (status, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
