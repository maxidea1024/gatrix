-- 005_create_invitations_and_privacy.sql
-- 채널 초대 및 사용자 프라이버시 설정 테이블 생성

-- 채널 초대 테이블
CREATE TABLE IF NOT EXISTS `chat_channel_invitations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `channelId` int(11) NOT NULL,
  `inviterId` int(11) NOT NULL,
  `inviteeId` int(11) NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expiresAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_channel_invitations_channel` (`channelId`),
  KEY `idx_channel_invitations_inviter` (`inviterId`),
  KEY `idx_channel_invitations_invitee` (`inviteeId`),
  KEY `idx_channel_invitations_status` (`status`),
  KEY `idx_channel_invitations_expires` (`expiresAt`),
  UNIQUE KEY `unique_pending_invitation` (`channelId`, `inviteeId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 프라이버시 설정 테이블
CREATE TABLE IF NOT EXISTS `chat_user_privacy_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `allowDirectMessages` enum('everyone','friends','none') NOT NULL DEFAULT 'everyone',
  `allowChannelInvites` enum('everyone','friends','none') NOT NULL DEFAULT 'everyone',
  `allowGroupInvites` enum('everyone','friends','none') NOT NULL DEFAULT 'everyone',
  `showOnlineStatus` tinyint(1) NOT NULL DEFAULT 1,
  `showLastSeen` tinyint(1) NOT NULL DEFAULT 1,
  `allowReadReceipts` tinyint(1) NOT NULL DEFAULT 1,
  `allowTypingIndicators` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_privacy` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 프라이버시 설정 삽입 (기존 사용자들을 위해)
INSERT IGNORE INTO `chat_user_privacy_settings` (`userId`, `allowDirectMessages`, `allowChannelInvites`, `allowGroupInvites`)
SELECT DISTINCT `userId`, 'everyone', 'everyone', 'everyone'
FROM `chat_channel_members`
WHERE `userId` NOT IN (SELECT `userId` FROM `chat_user_privacy_settings`);
