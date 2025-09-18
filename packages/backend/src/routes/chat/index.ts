import express from 'express';
import axios, { AxiosResponse } from 'axios';
import { authenticate } from '../../middleware/auth';
import logger from '../../config/logger';

const router = express.Router();

// 채팅서버 설정
const CHAT_SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3001';
const CHAT_API_BASE = `${CHAT_SERVER_URL}/api/v1`;

// 모든 채팅 라우트에 인증 필요
router.use(authenticate as any);

// 채팅서버로 요청을 프록시하는 헬퍼 함수
const proxyChatRequest = async (req: express.Request, res: express.Response) => {
  try {
    const { method, url, body, headers } = req;
    
    // 원본 URL에서 /api/v1/chat 부분을 제거하고 채팅서버 URL로 변경
    const chatPath = url.replace('/api/v1/chat', '');
    const targetUrl = `${CHAT_API_BASE}${chatPath}`;
    
    // 인증 토큰을 채팅서버로 전달
    const authHeader = headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    logger.info(`Proxying chat request: ${method} ${targetUrl}`, {
      originalUrl: url,
      targetUrl,
      hasAuth: !!authHeader
    });

    // 채팅서버로 요청 전달
    const response: AxiosResponse = await axios({
      method: method.toLowerCase() as any,
      url: targetUrl,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      timeout: 10000,
    });

    // 채팅서버 응답을 클라이언트로 전달
    res.status(response.status).json(response.data);

  } catch (error: any) {
    logger.error('Chat proxy error:', {
      error: error.message,
      url: req.url,
      method: req.method,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response) {
      // 채팅서버에서 온 에러 응답
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      // 채팅서버 연결 실패
      res.status(503).json({
        success: false,
        error: 'Chat service unavailable',
        message: 'Unable to connect to chat server'
      });
    } else {
      // 기타 에러
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};

// 모든 채팅 관련 요청을 채팅서버로 프록시
router.all('/*', proxyChatRequest);

export default router;
