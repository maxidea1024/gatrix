import { Router } from 'express';
import multer from 'multer';
import { ChannelController } from '../controllers/ChannelController';
import { MessageController } from '../controllers/MessageController';
import { InvitationController } from '../controllers/InvitationController';
import { authenticate, rateLimiter, validateInput } from '../middleware/auth';
import Joi from 'joi';

// Multer 설정 - 메모리 저장소 사용 (임시)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // 최대 5개 파일
  },
  fileFilter: (req, file, cb) => {
    // 허용할 파일 타입 (이미지, 문서, 비디오 등)
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const router = Router();

// 입력 검증 스키마
const createChannelSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  type: Joi.string().valid('public', 'private', 'direct').required(),
  maxMembers: Joi.number().integer().min(1).max(10000).optional(),
  settings: Joi.object({
    allowFileUploads: Joi.boolean().optional(),
    allowReactions: Joi.boolean().optional(),
    slowMode: Joi.number().integer().min(0).optional(),
    maxMessageLength: Joi.number().integer().min(1).max(10000).optional(),
    autoDeleteMessages: Joi.boolean().optional(),
    autoDeleteDays: Joi.number().integer().min(1).max(365).optional(),
    requireApproval: Joi.boolean().optional(),
    allowedFileTypes: Joi.array().items(Joi.string()).optional(),
    maxFileSize: Joi.number().integer().min(1).optional(),
  }).optional(),
  memberIds: Joi.array().items(Joi.number().integer()).optional(),
});

const updateChannelSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  maxMembers: Joi.number().integer().min(1).max(10000).optional(),
  settings: Joi.object({
    allowFileUploads: Joi.boolean().optional(),
    allowReactions: Joi.boolean().optional(),
    slowMode: Joi.number().integer().min(0).optional(),
    maxMessageLength: Joi.number().integer().min(1).max(10000).optional(),
    autoDeleteMessages: Joi.boolean().optional(),
    autoDeleteDays: Joi.number().integer().min(1).max(365).optional(),
    requireApproval: Joi.boolean().optional(),
    allowedFileTypes: Joi.array().items(Joi.string()).optional(),
    maxFileSize: Joi.number().integer().min(1).optional(),
  }).optional(),
});

const deleteChannelSchema = Joi.object({
  reason: Joi.string().max(500).optional(),
});

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 채널 생성
router.post(
  '/',
  rateLimiter(60000, 10), // 1분에 10개 채널 생성 제한
  validateInput(createChannelSchema),
  ChannelController.create
);

// 사용자의 채널 목록 조회
router.get(
  '/my',
  rateLimiter(60000, 100), // 1분에 100회 요청 제한
  ChannelController.getUserChannels
);

// 인기 채널 조회
router.get(
  '/popular',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  ChannelController.getPopular
);

// 채널 검색
router.get(
  '/search',
  rateLimiter(60000, 60), // 1분에 60회 검색 제한
  ChannelController.search
);

// 특정 채널 조회
router.get(
  '/:id',
  rateLimiter(60000, 200), // 1분에 200회 요청 제한
  ChannelController.getById
);

// 채널 업데이트
router.put(
  '/:id',
  rateLimiter(60000, 20), // 1분에 20회 업데이트 제한
  validateInput(updateChannelSchema),
  ChannelController.update
);

// 채널 삭제
router.delete(
  '/:id',
  rateLimiter(60000, 5), // 1분에 5회 삭제 제한
  validateInput(deleteChannelSchema),
  ChannelController.delete
);

// 채널 통계 조회
router.get(
  '/:id/stats',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  ChannelController.getStats
);

// 채널의 메시지 조회
router.get(
  '/:id/messages',
  rateLimiter(60000, 200), // 1분에 200회 요청 제한
  ChannelController.getMessages
);

// 채널을 읽음으로 표시
router.post(
  '/:id/read',
  rateLimiter(60000, 100), // 1분에 100회 요청 제한
  ChannelController.markAsRead
);

// 채널에 메시지 보내기
router.post(
  '/:id/messages',
  rateLimiter(60000, 60), // 1분에 60개 메시지 생성 제한
  upload.array('attachments', 5) as any, // 최대 5개 파일 첨부 허용
  MessageController.createInChannel
);

// 채널 참여
router.post(
  '/:id/join',
  rateLimiter(60000, 30), // 1분에 30회 참여 제한
  ChannelController.joinChannel
);

// 채널 나가기
router.post(
  '/:id/leave',
  rateLimiter(60000, 30), // 1분에 30회 나가기 제한
  ChannelController.leaveChannel
);

// 채널에 사용자 초대
router.post(
  '/:channelId/invite',
  rateLimiter(60000, 20), // 1분에 20회 초대 제한
  InvitationController.inviteUser
);

// 채널의 pending invitation 목록 조회
router.get(
  '/:channelId/pending-invitations',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  InvitationController.getChannelPendingInvitations
);

// 채널 존재 여부 확인
router.head(
  '/:id',
  rateLimiter(60000, 100), // 1분에 100회 요청 제한
  ChannelController.checkExists
);

export default router;
