-- 기존 테이블 삭제
DROP TABLE IF EXISTS chat_message_reactions;

-- 새로운 테이블 생성 (간단한 구조)
CREATE TABLE chat_message_reactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  messageId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  
  -- 외래키 제약조건
  FOREIGN KEY (messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES chat_users(gatrixUserId) ON DELETE CASCADE,
  
  -- 복합 유니크 인덱스
  UNIQUE KEY unique_user_message_emoji (messageId, userId, emoji),
  
  -- 인덱스
  INDEX idx_messageId (messageId),
  INDEX idx_userId (userId),
  INDEX idx_emoji (emoji)
) DEFAULT CHARACTER SET utf8mb4;

-- 테스트 데이터 삽입
INSERT INTO chat_message_reactions (messageId, userId, emoji) VALUES 
(107, 3, '👍'),
(107, 3, '❤️'),
(107, 3, '😂');
