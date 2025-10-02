import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from '../config';
import logger from '../config/logger';

const router = express.Router();

// Event Lens 서버 URL
const EVENT_LENS_URL = process.env.EVENT_LENS_URL || 'http://localhost:3002';

// Event Lens Proxy
router.use('/', createProxyMiddleware({
  target: EVENT_LENS_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/analytics': '', // /api/v1/analytics/* -> /*
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.debug('Proxying to Event Lens', {
      method: req.method,
      path: req.path,
      target: EVENT_LENS_URL,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.debug('Event Lens response', {
      statusCode: proxyRes.statusCode,
      path: req.path,
    });
  },
  onError: (err, req, res) => {
    logger.error('Event Lens proxy error', {
      error: err.message,
      path: req.path,
    });
    
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'Event Lens service is unavailable',
    });
  },
}));

export default router;

