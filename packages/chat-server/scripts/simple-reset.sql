-- 채팅 관련 데이터 초기화 SQL
-- 외래키 순서를 고려하여 삭제

-- 1. 메시지 삭제
DELETE FROM g_messages WHERE 1=1;

-- 2. 채널 멤버 삭제  
DELETE FROM g_channel_members WHERE 1=1;

-- 3. 채널 초대 삭제
DELETE FROM g_channel_invitations WHERE 1=1;

-- 4. 채널 삭제
DELETE FROM g_channels WHERE 1=1;

-- 5. DM 참가자 삭제
DELETE FROM g_direct_message_participants WHERE 1=1;

-- 6. 사용자 프라이버시 설정 삭제
DELETE FROM g_user_privacy_settings WHERE 1=1;

-- AUTO_INCREMENT 리셋 (선택사항)
ALTER TABLE g_messages AUTO_INCREMENT = 1;
ALTER TABLE g_channels AUTO_INCREMENT = 1;
ALTER TABLE g_channel_invitations AUTO_INCREMENT = 1;

SELECT 'Chat data reset completed!' as status;
