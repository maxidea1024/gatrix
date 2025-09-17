import { Router } from 'express';
import { ChannelController } from '../controllers/ChannelController';
import { authenticate, rateLimiter, validateInput } from '../middleware/auth';
import Joi from 'joi';

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

// 채널 존재 여부 확인
router.head(
  '/:id',
  rateLimiter(60000, 100), // 1분에 100회 요청 제한
  ChannelController.checkExists
);

export default router;
