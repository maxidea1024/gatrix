import { Router } from 'express';
import { MessageController } from '../controllers/MessageController';
import { authenticate, rateLimiter, validateInput } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

// 입력 검증 스키마
const createMessageSchema = Joi.object({
  channelId: Joi.number().integer().required(),
  content: Joi.string().min(1).max(10000).required(),
  contentType: Joi.string().valid('text', 'image', 'video', 'audio', 'file', 'location').optional(),
  messageData: Joi.object({
    mentions: Joi.array().items(Joi.number().integer()).optional(),
    hashtags: Joi.array().items(Joi.string()).optional(),
    links: Joi.array().items(Joi.object({
      url: Joi.string().uri().required(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      image: Joi.string().uri().optional(),
      siteName: Joi.string().optional(),
    })).optional(),
    location: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required(),
      address: Joi.string().optional(),
      placeName: Joi.string().optional(),
    }).optional(),
    poll: Joi.object({
      question: Joi.string().required(),
      options: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        text: Joi.string().required(),
        votes: Joi.number().integer().default(0),
        voters: Joi.array().items(Joi.number().integer()).default([]),
      })).required(),
      allowMultiple: Joi.boolean().default(false),
      expiresAt: Joi.date().optional(),
    }).optional(),
    formatting: Joi.object({
      bold: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      italic: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      underline: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      strikethrough: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      code: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      codeBlock: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
        language: Joi.string().optional(),
      })).optional(),
    }).optional(),
  }).optional(),
  replyToMessageId: Joi.number().integer().optional(),
  threadId: Joi.number().integer().optional(),
});

const updateMessageSchema = Joi.object({
  content: Joi.string().min(1).max(10000).optional(),
  messageData: Joi.object({
    mentions: Joi.array().items(Joi.number().integer()).optional(),
    hashtags: Joi.array().items(Joi.string()).optional(),
    links: Joi.array().items(Joi.object({
      url: Joi.string().uri().required(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      image: Joi.string().uri().optional(),
      siteName: Joi.string().optional(),
    })).optional(),
    formatting: Joi.object({
      bold: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      italic: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      underline: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      strikethrough: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      code: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
      })).optional(),
      codeBlock: Joi.array().items(Joi.object({
        start: Joi.number().integer().required(),
        end: Joi.number().integer().required(),
        language: Joi.string().optional(),
      })).optional(),
    }).optional(),
  }).optional(),
});

const batchDeleteSchema = Joi.object({
  messageIds: Joi.array().items(Joi.number().integer()).min(1).max(100).required(),
});

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 메시지 생성
router.post(
  '/',
  rateLimiter(60000, 60), // 1분에 60개 메시지 생성 제한
  validateInput(createMessageSchema),
  MessageController.create
);

// 메시지 검색
router.get(
  '/search',
  rateLimiter(60000, 30), // 1분에 30회 검색 제한
  MessageController.search
);

// 배치 메시지 삭제
router.delete(
  '/batch',
  rateLimiter(60000, 10), // 1분에 10회 배치 삭제 제한
  validateInput(batchDeleteSchema),
  MessageController.batchDelete
);

// 채널의 메시지 목록 조회
router.get(
  '/channel/:channelId',
  rateLimiter(60000, 200), // 1분에 200회 요청 제한
  MessageController.getByChannelId
);

// 스레드 메시지 조회
router.get(
  '/thread/:threadId',
  rateLimiter(60000, 100), // 1분에 100회 요청 제한
  MessageController.getThreadMessages
);

// 특정 메시지 조회
router.get(
  '/:id',
  rateLimiter(60000, 300), // 1분에 300회 요청 제한
  MessageController.getById
);

// 메시지 업데이트
router.put(
  '/:id',
  rateLimiter(60000, 30), // 1분에 30회 업데이트 제한
  validateInput(updateMessageSchema),
  MessageController.update
);

// 메시지 삭제
router.delete(
  '/:id',
  rateLimiter(60000, 30), // 1분에 30회 삭제 제한
  MessageController.delete
);

// 메시지 핀 토글
router.patch(
  '/:id/pin',
  rateLimiter(60000, 20), // 1분에 20회 핀 토글 제한
  MessageController.togglePin
);

// 스레드 메시지 조회
router.get(
  '/thread/:threadId',
  rateLimiter(60000, 100), // 1분에 100회 조회 제한
  MessageController.getThreadMessages
);

export default router;
