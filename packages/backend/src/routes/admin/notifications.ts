import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import SSENotificationService from '../../services/sse-notification-service';
import { pubSubService } from '../../services/pub-sub-service';
import { createLogger } from '../../config/logger';

const logger = createLogger('notifications');

const router = Router();
const sseService = SSENotificationService.getInstance();

/**
 * Custom authentication middleware for SSE that supports query parameter tokens
 */
const authenticateSSE = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no header token, try query parameter
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        success: false,
        error: { message: 'Access token is required' },
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
};

/**
 * SSE endpoint for real-time notifications
 */
router.get('/sse', authenticateSSE, (req: Request, res: Response) => {
  const clientId = uuidv4();
  const userId = (req as any).user?.userId;

  try {
    // Add client to SSE service
    sseService.addClient(clientId, res, userId);

    // Subscribe to admin channels (this endpoint is admin-only)
    sseService.subscribe(clientId, ['admin', 'remote_config', 'campaigns']);

    logger.info(`SSE connection established for user ${userId} with client ${clientId}`);
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    res.status(500).json({ error: 'Failed to establish SSE connection' });
  }
});

// Apply authentication middleware to non-SSE routes
router.use(['/sse/subscribe', '/sse/unsubscribe', '/test', '/stats'], authenticate as any);

/**
 * Subscribe to specific channels
 */
router.post('/sse/subscribe', (req: Request, res: Response) => {
  const { clientId, channels } = req.body;

  if (!clientId || !Array.isArray(channels)) {
    return res.status(400).json({ error: 'clientId and channels array are required' });
  }

  try {
    sseService.subscribe(clientId, channels);
    res.json({
      success: true,
      message: `Subscribed to channels: ${channels.join(', ')}`,
    });
  } catch (error) {
    logger.error('Error subscribing to channels:', error);
    res.status(500).json({ error: 'Failed to subscribe to channels' });
  }
});

/**
 * Unsubscribe from specific channels
 */
router.post('/sse/unsubscribe', (req: Request, res: Response) => {
  const { clientId, channels } = req.body;

  if (!clientId || !Array.isArray(channels)) {
    return res.status(400).json({ error: 'clientId and channels array are required' });
  }

  try {
    sseService.unsubscribe(clientId, channels);
    res.json({
      success: true,
      message: `Unsubscribed from channels: ${channels.join(', ')}`,
    });
  } catch (error) {
    logger.error('Error unsubscribing from channels:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from channels' });
  }
});

/**
 * Send test notification (admin only)
 */
router.post('/test', async (req: Request, res: Response) => {
  const { type, data, targetUsers, targetChannels } = req.body;

  try {
    // Publish via PubSub so all instances receive the notification
    await pubSubService.publishNotification({
      type: type || 'test',
      data: data || { message: 'Test notification' },
      targetUsers,
      targetChannels,
    });

    res.json({
      success: true,
      message: 'Test notification published to all instances',
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * Get SSE service statistics (admin only)
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = sseService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting SSE stats:', error);
    res.status(500).json({ error: 'Failed to get SSE statistics' });
  }
});

export default router;
