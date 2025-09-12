-- 온라인 게임용 Remote Config Mock 데이터
-- 실제 게임에서 사용할 법한 설정들과 A/B 테스트 데이터

-- 컨텍스트 필드 추가 (게임 타겟팅용)
INSERT INTO g_context_fields (`key`, name, description, `type`, options, defaultValue, validation, isActive, isSystem, createdBy) VALUES
('player_level', '플레이어 레벨', '플레이어의 현재 레벨', 'number', '{"min": 1, "max": 100}', '1', '{"required": true, "min": 1, "max": 100}', TRUE, FALSE, 1),
('player_vip_level', 'VIP 레벨', '플레이어의 VIP 등급', 'number', '{"min": 0, "max": 10}', '0', '{"required": false, "min": 0, "max": 10}', TRUE, FALSE, 1),
('player_country', '국가', '플레이어의 국가 코드', 'string', '{"values": ["KR", "US", "JP", "CN", "TW", "TH", "VN", "ID"]}', 'KR', '{"required": true, "enum": ["KR", "US", "JP", "CN", "TW", "TH", "VN", "ID"]}', TRUE, FALSE, 1),
('device_platform', '플랫폼', '디바이스 플랫폼', 'string', '{"values": ["android", "ios", "web", "pc"]}', 'android', '{"required": true, "enum": ["android", "ios", "web", "pc"]}', TRUE, FALSE, 1),
('guild_member', '길드 가입 여부', '길드에 가입했는지 여부', 'boolean', '{}', 'false', '{"required": false}', TRUE, FALSE, 1),
('payment_tier', '결제 등급', '플레이어의 결제 등급', 'string', '{"values": ["free", "light", "medium", "heavy", "whale"]}', 'free', '{"required": false, "enum": ["free", "light", "medium", "heavy", "whale"]}', TRUE, FALSE, 1),
('play_time_hours', '플레이 시간', '총 플레이 시간 (시간)', 'number', '{"min": 0}', '0', '{"required": false, "min": 0}', TRUE, FALSE, 1),
('last_login_days', '마지막 로그인', '마지막 로그인으로부터 경과 일수', 'number', '{"min": 0}', '0', '{"required": false, "min": 0}', TRUE, FALSE, 1);

-- Remote Config 컨텍스트 필드 추가
INSERT INTO g_remote_config_context_fields (fieldName, fieldType, description, isRequired, defaultValue, validationRules, createdBy) VALUES
('player_level', 'number', '플레이어 레벨 (1-100)', FALSE, '1', '{"min": 1, "max": 100}', 1),
('player_vip_level', 'number', 'VIP 레벨 (0-10)', FALSE, '0', '{"min": 0, "max": 10}', 1),
('player_country', 'string', '국가 코드', FALSE, 'KR', '{"enum": ["KR", "US", "JP", "CN", "TW", "TH", "VN", "ID"]}', 1),
('device_platform', 'string', '디바이스 플랫폼', FALSE, 'android', '{"enum": ["android", "ios", "web", "pc"]}', 1),
('guild_member', 'boolean', '길드 가입 여부', FALSE, 'false', '{}', 1),
('payment_tier', 'string', '결제 등급', FALSE, 'free', '{"enum": ["free", "light", "medium", "heavy", "whale"]}', 1);

-- 게임 설정용 Remote Configs
INSERT INTO g_remote_configs (keyName, defaultValue, valueType, description, isActive, createdBy) VALUES
-- 게임 밸런싱
('max_energy', '100', 'number', '플레이어 최대 에너지', TRUE, 1),
('energy_regen_rate', '1', 'number', '에너지 회복 속도 (분당)', TRUE, 1),
('daily_login_bonus', '{"day1": 100, "day2": 200, "day3": 300, "day4": 500, "day5": 1000, "day6": 1500, "day7": 2000}', 'json', '일일 로그인 보너스 골드', TRUE, 1),
('exp_multiplier', '1.0', 'number', '경험치 배율', TRUE, 1),
('gold_multiplier', '1.0', 'number', '골드 획득 배율', TRUE, 1),

-- 상점 설정
('shop_refresh_cost', '50', 'number', '상점 새로고침 비용 (다이아)', TRUE, 1),
('shop_items_count', '6', 'number', '상점에 표시할 아이템 수', TRUE, 1),
('premium_shop_enabled', 'true', 'boolean', '프리미엄 상점 활성화', TRUE, 1),

-- 이벤트 설정
('weekend_bonus_active', 'false', 'boolean', '주말 보너스 이벤트 활성화', TRUE, 1),
('weekend_bonus_multiplier', '2.0', 'number', '주말 보너스 배율', TRUE, 1),
('special_event_banner', '{"title": "신규 영웅 출시!", "description": "새로운 전설 영웅을 만나보세요", "image_url": "/images/hero_banner.jpg", "action_url": "/summon"}', 'json', '특별 이벤트 배너', TRUE, 1),

-- PvP 설정
('pvp_season_active', 'true', 'boolean', 'PvP 시즌 활성화', TRUE, 1),
('pvp_match_timeout', '300', 'number', 'PvP 매치 제한시간 (초)', TRUE, 1),
('pvp_reward_multiplier', '1.5', 'number', 'PvP 보상 배율', TRUE, 1),

-- 길드 설정
('guild_max_members', '30', 'number', '길드 최대 인원', TRUE, 1),
('guild_war_enabled', 'true', 'boolean', '길드전 활성화', TRUE, 1),
('guild_donation_limit', '5', 'number', '일일 길드 기부 한도', TRUE, 1),

-- 가챠/소환 설정
('summon_rates', '{"common": 70, "rare": 25, "epic": 4.5, "legendary": 0.5}', 'json', '소환 확률 (%)', TRUE, 1),
('pity_system_enabled', 'true', 'boolean', '천장 시스템 활성화', TRUE, 1),
('pity_counter_max', '100', 'number', '천장 카운터 최대값', TRUE, 1),

-- 알림 설정
('push_notifications_enabled', 'true', 'boolean', '푸시 알림 활성화', TRUE, 1),
('maintenance_message', '{"ko": "점검 중입니다. 잠시 후 다시 접속해주세요.", "en": "Under maintenance. Please try again later.", "ja": "メンテナンス中です。しばらくしてから再度アクセスしてください。"}', 'json', '점검 메시지', TRUE, 1),

-- 신규 유저 설정
('newbie_protection_days', '7', 'number', '신규 유저 보호 기간 (일)', TRUE, 1),
('starter_pack_enabled', 'true', 'boolean', '스타터 팩 활성화', TRUE, 1),
('tutorial_skip_enabled', 'false', 'boolean', '튜토리얼 스킵 허용', TRUE, 1),

-- 경제 설정
('daily_gold_limit', '10000', 'number', '일일 골드 획득 한도', TRUE, 1),
('diamond_exchange_rate', '100', 'number', '골드 1개당 다이아 교환 비율', TRUE, 1),
('auction_house_enabled', 'true', 'boolean', '경매장 활성화', TRUE, 1);

-- 게임 설정들의 초기 버전 생성 (published 상태)
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, publishedAt, createdBy)
SELECT id, 1, defaultValue, 'published', '초기 설정값', NOW(), 1
FROM g_remote_configs
WHERE keyName IN ('max_energy', 'energy_regen_rate', 'daily_login_bonus', 'exp_multiplier', 'gold_multiplier',
                  'shop_refresh_cost', 'shop_items_count', 'premium_shop_enabled', 'weekend_bonus_active',
                  'weekend_bonus_multiplier', 'special_event_banner', 'pvp_season_active', 'pvp_match_timeout',
                  'pvp_reward_multiplier', 'guild_max_members', 'guild_war_enabled', 'guild_donation_limit',
                  'summon_rates', 'pity_system_enabled', 'pity_counter_max', 'push_notifications_enabled',
                  'maintenance_message', 'newbie_protection_days', 'starter_pack_enabled', 'tutorial_skip_enabled',
                  'daily_gold_limit', 'diamond_exchange_rate', 'auction_house_enabled');

-- A/B 테스트용 캠페인 생성
INSERT INTO g_remote_config_campaigns (campaignName, description, startDate, endDate, targetConditions, isActive, priority, status, createdBy) VALUES
-- 신규 유저 온보딩 A/B 테스트
('신규유저_튜토리얼_AB테스트', '신규 유저를 위한 튜토리얼 방식 A/B 테스트',
 DATE_ADD(NOW(), INTERVAL -7 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY),
 '{"player_level": {"operator": "<=", "value": 5}, "last_login_days": {"operator": "<=", "value": 3}}',
 TRUE, 1, 'running', 1),

-- VIP 유저 대상 프리미엄 혜택 테스트
('VIP유저_프리미엄혜택_테스트', 'VIP 유저 대상 프리미엄 혜택 개선 테스트',
 DATE_ADD(NOW(), INTERVAL -3 DAY), DATE_ADD(NOW(), INTERVAL 14 DAY),
 '{"player_vip_level": {"operator": ">=", "value": 3}, "payment_tier": {"operator": "in", "value": ["medium", "heavy", "whale"]}}',
 TRUE, 2, 'running', 1),

-- 국가별 이벤트 테스트
('아시아지역_특별이벤트', '아시아 지역 대상 특별 이벤트',
 DATE_ADD(NOW(), INTERVAL -1 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY),
 '{"player_country": {"operator": "in", "value": ["KR", "JP", "TW"]}}',
 TRUE, 3, 'running', 1),

-- 고레벨 유저 밸런싱 테스트
('고레벨유저_밸런싱_테스트', '레벨 50 이상 유저 대상 게임 밸런싱 테스트',
 NOW(), DATE_ADD(NOW(), INTERVAL 21 DAY),
 '{"player_level": {"operator": ">=", "value": 50}, "guild_member": {"operator": "==", "value": true}}',
 TRUE, 4, 'scheduled', 1),

-- 플랫폼별 UI 테스트
('모바일_UI개선_테스트', '모바일 플랫폼 UI 개선 테스트',
 DATE_ADD(NOW(), INTERVAL -5 DAY), DATE_ADD(NOW(), INTERVAL 12 DAY),
 '{"device_platform": {"operator": "in", "value": ["android", "ios"]}}',
 TRUE, 5, 'running', 1),

-- 복귀 유저 대상 이벤트
('복귀유저_웰컴백_이벤트', '7일 이상 미접속 유저 대상 복귀 이벤트',
 DATE_ADD(NOW(), INTERVAL -2 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY),
 '{"last_login_days": {"operator": ">=", "value": 7}, "player_level": {"operator": ">=", "value": 10}}',
 TRUE, 6, 'running', 1);

-- A/B 테스트용 설정값들 추가
INSERT INTO g_remote_configs (keyName, defaultValue, valueType, description, isActive, createdBy) VALUES
-- 튜토리얼 A/B 테스트용
('tutorial_type', 'classic', 'string', '튜토리얼 타입 (classic/interactive)', TRUE, 1),
('tutorial_reward_gold', '500', 'number', '튜토리얼 완료 보상 골드', TRUE, 1),

-- VIP 혜택 A/B 테스트용
('vip_daily_bonus_multiplier', '1.0', 'number', 'VIP 일일 보너스 배율', TRUE, 1),
('vip_shop_discount', '0', 'number', 'VIP 상점 할인율 (%)', TRUE, 1),

-- 이벤트 A/B 테스트용
('event_banner_style', 'standard', 'string', '이벤트 배너 스타일', TRUE, 1),
('event_reward_multiplier', '1.0', 'number', '이벤트 보상 배율', TRUE, 1),

-- 밸런싱 A/B 테스트용
('high_level_exp_bonus', '0', 'number', '고레벨 경험치 보너스 (%)', TRUE, 1),
('guild_bonus_active', 'false', 'boolean', '길드 보너스 활성화', TRUE, 1),

-- UI A/B 테스트용
('mobile_ui_version', 'v1', 'string', '모바일 UI 버전', TRUE, 1),
('button_style', 'rounded', 'string', '버튼 스타일', TRUE, 1),

-- 복귀 유저 이벤트용
('comeback_bonus_days', '7', 'number', '복귀 보너스 지급 일수', TRUE, 1),
('comeback_gift_package', '{"gold": 5000, "diamonds": 100, "energy": 50}', 'json', '복귀 선물 패키지', TRUE, 1);

-- 캠페인별 설정값 매핑 (g_remote_config_campaign_configs는 아직 구현되지 않았으므로 주석 처리)
-- 대신 각 캠페인에 대한 draft 버전들을 생성하여 A/B 테스트 시뮬레이션

-- 1. 신규유저 튜토리얼 A/B 테스트 - 변형 A (기본값)
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, 'classic', 'draft', '신규유저 A/B테스트 - 클래식 튜토리얼', 1
FROM g_remote_configs WHERE keyName = 'tutorial_type';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '500', 'draft', '신규유저 A/B테스트 - 기본 보상', 1
FROM g_remote_configs WHERE keyName = 'tutorial_reward_gold';

-- 1. 신규유저 튜토리얼 A/B 테스트 - 변형 B (개선된 버전)
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 3, 'interactive', 'draft', '신규유저 A/B테스트 - 인터랙티브 튜토리얼', 1
FROM g_remote_configs WHERE keyName = 'tutorial_type';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 3, '1000', 'draft', '신규유저 A/B테스트 - 증가된 보상', 1
FROM g_remote_configs WHERE keyName = 'tutorial_reward_gold';

-- 2. VIP 유저 프리미엄 혜택 테스트 - 변형 A
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '1.5', 'draft', 'VIP 혜택 테스트 - 1.5배 보너스', 1
FROM g_remote_configs WHERE keyName = 'vip_daily_bonus_multiplier';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '10', 'draft', 'VIP 혜택 테스트 - 10% 할인', 1
FROM g_remote_configs WHERE keyName = 'vip_shop_discount';

-- 2. VIP 유저 프리미엄 혜택 테스트 - 변형 B
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 3, '2.0', 'draft', 'VIP 혜택 테스트 - 2.0배 보너스', 1
FROM g_remote_configs WHERE keyName = 'vip_daily_bonus_multiplier';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 3, '20', 'draft', 'VIP 혜택 테스트 - 20% 할인', 1
FROM g_remote_configs WHERE keyName = 'vip_shop_discount';

-- 3. 아시아 지역 특별 이벤트 - 변형 A
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, 'asian_festival', 'draft', '아시아 이벤트 - 축제 스타일', 1
FROM g_remote_configs WHERE keyName = 'event_banner_style';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '1.5', 'draft', '아시아 이벤트 - 1.5배 보상', 1
FROM g_remote_configs WHERE keyName = 'event_reward_multiplier';

-- 4. 고레벨 유저 밸런싱 테스트
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '25', 'draft', '고레벨 밸런싱 - 25% 경험치 보너스', 1
FROM g_remote_configs WHERE keyName = 'high_level_exp_bonus';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, 'true', 'draft', '고레벨 밸런싱 - 길드 보너스 활성화', 1
FROM g_remote_configs WHERE keyName = 'guild_bonus_active';

-- 5. 모바일 UI 개선 테스트
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, 'v2', 'draft', '모바일 UI - 새로운 버전', 1
FROM g_remote_configs WHERE keyName = 'mobile_ui_version';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, 'modern', 'draft', '모바일 UI - 모던 버튼 스타일', 1
FROM g_remote_configs WHERE keyName = 'button_style';

-- 6. 복귀 유저 웰컴백 이벤트
INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '14', 'draft', '복귀 이벤트 - 14일 보너스', 1
FROM g_remote_configs WHERE keyName = 'comeback_bonus_days';

INSERT INTO g_remote_config_versions (configId, versionNumber, value, status, changeDescription, createdBy)
SELECT id, 2, '{"gold": 10000, "diamonds": 200, "energy": 100, "premium_summon_ticket": 3}', 'draft', '복귀 이벤트 - 프리미엄 패키지', 1
FROM g_remote_configs WHERE keyName = 'comeback_gift_package';

-- 추가 게임 설정들
INSERT INTO g_remote_configs (keyName, defaultValue, valueType, description, isActive, createdBy) VALUES
-- 던전 및 스테이지 설정
('dungeon_entry_cost', '10', 'number', '던전 입장 비용 (에너지)', TRUE, 1),
('boss_raid_enabled', 'true', 'boolean', '보스 레이드 활성화', TRUE, 1),
('daily_dungeon_attempts', '3', 'number', '일일 던전 도전 횟수', TRUE, 1),
('stage_clear_rewards', '{"gold_base": 100, "exp_base": 50, "item_drop_rate": 0.15}', 'json', '스테이지 클리어 기본 보상', TRUE, 1),

-- 아이템 및 장비 설정
('equipment_upgrade_cost_multiplier', '1.0', 'number', '장비 강화 비용 배율', TRUE, 1),
('item_sell_price_ratio', '0.5', 'number', '아이템 판매가 비율', TRUE, 1),
('legendary_drop_rate', '0.01', 'number', '전설 아이템 드롭률', TRUE, 1),
('inventory_max_slots', '100', 'number', '인벤토리 최대 슬롯', TRUE, 1),

-- 친구 및 소셜 기능
('friend_max_count', '50', 'number', '최대 친구 수', TRUE, 1),
('friend_energy_gift', '5', 'number', '친구 에너지 선물량', TRUE, 1),
('social_sharing_reward', '{"gold": 100, "exp": 50}', 'json', '소셜 공유 보상', TRUE, 1),

-- 랭킹 및 리더보드
('leaderboard_update_interval', '3600', 'number', '리더보드 업데이트 간격 (초)', TRUE, 1),
('season_ranking_rewards', '{"rank1": {"gold": 50000, "diamonds": 1000}, "rank10": {"gold": 20000, "diamonds": 500}, "rank100": {"gold": 5000, "diamonds": 100}}', 'json', '시즌 랭킹 보상', TRUE, 1),

-- 이벤트 및 미션
('daily_mission_count', '5', 'number', '일일 미션 개수', TRUE, 1),
('weekly_mission_count', '7', 'number', '주간 미션 개수', TRUE, 1),
('achievement_rewards_multiplier', '1.0', 'number', '업적 보상 배율', TRUE, 1),
('login_streak_max', '30', 'number', '최대 연속 로그인 일수', TRUE, 1),

-- 인앱 결제 설정
('starter_pack_price', '0.99', 'number', '스타터 팩 가격 (USD)', TRUE, 1),
('monthly_pass_enabled', 'true', 'boolean', '월간 패스 활성화', TRUE, 1),
('diamond_package_bonus', '{"small": 0, "medium": 10, "large": 25, "mega": 50}', 'json', '다이아 패키지 보너스 (%)', TRUE, 1),

-- 채팅 및 커뮤니케이션
('chat_message_length_limit', '200', 'number', '채팅 메시지 최대 길이', TRUE, 1),
('chat_cooldown_seconds', '3', 'number', '채팅 쿨다운 (초)', TRUE, 1),
('profanity_filter_enabled', 'true', 'boolean', '욕설 필터 활성화', TRUE, 1),

-- 보안 및 치트 방지
('anti_cheat_enabled', 'true', 'boolean', '치트 방지 시스템 활성화', TRUE, 1),
('suspicious_activity_threshold', '10', 'number', '의심 활동 임계값', TRUE, 1),
('auto_ban_enabled', 'false', 'boolean', '자동 밴 시스템 활성화', TRUE, 1),

-- 성능 및 최적화
('max_concurrent_battles', '1000', 'number', '최대 동시 전투 수', TRUE, 1),
('server_maintenance_window', '{"start": "02:00", "end": "04:00", "timezone": "UTC+9"}', 'json', '서버 점검 시간', TRUE, 1),
('client_update_required', 'false', 'boolean', '클라이언트 업데이트 필수', TRUE, 1),

-- 지역화 및 다국어
('supported_languages', '["ko", "en", "ja", "zh-cn", "zh-tw"]', 'json', '지원 언어 목록', TRUE, 1),
('default_currency_symbol', '₩', 'string', '기본 통화 기호', TRUE, 1),
('timezone_offset', '+9', 'string', '기본 시간대 오프셋', TRUE, 1);

-- 계절 이벤트 설정
INSERT INTO g_remote_configs (keyName, defaultValue, valueType, description, isActive, createdBy) VALUES
('christmas_event_active', 'false', 'boolean', '크리스마스 이벤트 활성화', TRUE, 1),
('halloween_event_active', 'false', 'boolean', '할로윈 이벤트 활성화', TRUE, 1),
('summer_festival_active', 'false', 'boolean', '여름 축제 이벤트 활성화', TRUE, 1),
('new_year_event_active', 'false', 'boolean', '신년 이벤트 활성화', TRUE, 1),
('valentine_event_active', 'false', 'boolean', '발렌타인 이벤트 활성화', TRUE, 1);
