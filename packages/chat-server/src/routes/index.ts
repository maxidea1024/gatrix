import { Router } from 'express';
import channelsRouter from './channels';
import messagesRouter from './messages';
import { requestLogger, errorHandler } from '../middleware/auth';

const router = Router();

// 요청 로깅 미들웨어
router.use(requestLogger);

// API 정보 엔드포인트
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Gatrix Chat Server API',
      version: '1.0.0',
      description: 'High-performance scalable chat server for Gatrix platform',
      endpoints: {
        channels: '/api/v1/channels',
        messages: '/api/v1/messages',
        websocket: '/socket.io',
        health: '/health',
        metrics: '/metrics',
      },
      features: [
        'Real-time messaging',
        'Channel management',
        'File uploads',
        'Message reactions',
        'User presence',
        'Typing indicators',
        'Message search',
        'Thread support',
        'Message formatting',
        'Scalable architecture',
      ],
      limits: {
        maxMessageLength: 10000,
        maxFileSize: '10MB',
        maxChannelMembers: 10000,
        rateLimit: 'Varies by endpoint',
      },
    },
    timestamp: new Date().toISOString(),
    serverId: process.env.SERVER_ID || 'unknown',
  });
});

// 라우트 등록
router.use('/channels', channelsRouter);
router.use('/messages', messagesRouter);

// 404 핸들러
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid API endpoint`,
    availableEndpoints: [
      'GET /api/v1/',
      'GET /api/v1/channels',
      'POST /api/v1/channels',
      'GET /api/v1/channels/:id',
      'PUT /api/v1/channels/:id',
      'DELETE /api/v1/channels/:id',
      'GET /api/v1/channels/my',
      'GET /api/v1/channels/popular',
      'GET /api/v1/channels/search',
      'GET /api/v1/channels/:id/messages',
      'POST /api/v1/channels/:id/messages',
      'POST /api/v1/channels/:id/read',
      'GET /api/v1/messages',
      'POST /api/v1/messages',
      'GET /api/v1/messages/:id',
      'PUT /api/v1/messages/:id',
      'DELETE /api/v1/messages/:id',
      'GET /api/v1/messages/channel/:channelId',
      'GET /api/v1/messages/search',
      'GET /api/v1/messages/thread/:threadId',
    ],
    timestamp: new Date().toISOString(),
  });
});

// 에러 핸들링 미들웨어
router.use(errorHandler);

export default router;
