import express, { Response } from 'express';
import { mailService } from '../services/MailService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { MailType, MailPriority } from '../models/Mail';
import { pubSubService } from '../services/PubSubService';

const router = express.Router();

// All routes require authentication
router.use(authenticate as any);

/**
 * GET /api/mails
 * Get mails for the current user
 */
router.get('/', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Add 2 second delay for testing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const userId = req.user!.userId;
    const {
      isRead,
      isStarred,
      mailType,
      category,
      page = '1',
      limit = '20',
    } = req.query;

    const filters: any = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === 'true';
    }
    if (mailType) {
      filters.mailType = mailType as MailType;
    }
    if (category) {
      filters.category = category as string;
    }

    const result = await mailService.getMailsForUser(userId, filters);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get mails',
      error: error.message,
    });
  }
}) as any);

/**
 * GET /api/mails/sent
 * Get sent mails for the current user
 */
router.get('/sent', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Add 2 second delay for testing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const userId = req.user!.userId;
    const {
      page = '1',
      limit = '20',
    } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    const result = await mailService.getSentMailsForUser(userId, options);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / options.limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sent mails',
      error: error.message,
    });
  }
}) as any);

/**
 * GET /api/mails/unread-count
 * Get unread mail count for the current user
 */
router.get('/unread-count', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const count = await mailService.getUnreadCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message,
    });
  }
}) as any);

/**
 * GET /api/mails/stats
 * Get mail statistics for the current user
 */
router.get('/stats', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await mailService.getMailStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get mail stats',
      error: error.message,
    });
  }
}) as any);

/**
 * GET /api/mails/:id
 * Get a single mail by ID
 */
router.get('/:id', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const mail = await mailService.getMailById(mailId, userId);

    if (!mail) {
      return res.status(404).json({
        success: false,
        message: 'Mail not found',
      });
    }

    res.json({
      success: true,
      data: mail,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get mail',
      error: error.message,
    });
  }
}) as any);

/**
 * POST /api/mails
 * Send a new mail
 */
router.post('/', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      recipientId,
      subject,
      content,
      contentType = 'text',
      priority = 'normal',
      category,
      mailData,
    } = req.body;

    // Validation
    if (!recipientId || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'recipientId, subject, and content are required',
      });
    }

    // Add 2 second delay for better UX (show loading state)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mail = await mailService.sendMail({
      senderId: userId,
      senderName: req.user!.email,
      recipientId,
      subject,
      content,
      contentType,
      mailType: 'user',
      priority: priority as MailPriority,
      category,
      mailData,
    });

    // Send SSE notification to recipient
    await pubSubService.publishNotification({
      type: 'mail_received',
      data: {
        mailId: mail.id,
        senderId: userId,
        senderName: req.user!.email,
        subject,
        priority,
      },
      targetUsers: [recipientId],
    });

    res.status(201).json({
      success: true,
      data: mail,
      message: 'Mail sent successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to send mail',
      error: error.message,
    });
  }
}) as any);

/**
 * PATCH /api/mails/:id/read
 * Mark a mail as read
 */
router.patch('/:id/read', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const result = await mailService.markAsRead(mailId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Mail not found',
      });
    }

    res.json({
      success: true,
      message: 'Mail marked as read',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark mail as read',
      error: error.message,
    });
  }
}) as any);

/**
 * PATCH /api/mails/read-multiple
 * Mark multiple mails as read
 */
router.patch('/read-multiple', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { mailIds } = req.body;

    if (!Array.isArray(mailIds) || mailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'mailIds array is required',
      });
    }

    const count = await mailService.markMultipleAsRead(mailIds, userId);

    res.json({
      success: true,
      count,
      message: `${count} mails marked as read`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark mails as read',
      error: error.message,
    });
  }
}) as any);

/**
 * PATCH /api/mails/read-all
 * Mark all unread mails as read (with optional filters)
 */
router.patch('/read-all', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { isRead, isStarred } = req.query;

    const filters: any = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === 'false'; // Only mark unread mails
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === 'true';
    }

    const count = await mailService.markAllAsRead(userId, filters);

    res.json({
      success: true,
      count,
      message: `${count} mails marked as read`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all mails as read',
      error: error.message,
    });
  }
}) as any);

/**
 * PATCH /api/mails/:id/star
 * Toggle starred status
 */
router.patch('/:id/star', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const isStarred = await mailService.toggleStarred(mailId, userId);

    res.json({
      success: true,
      isStarred,
      message: isStarred ? 'Mail starred' : 'Mail unstarred',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle starred status',
      error: error.message,
    });
  }
}) as any);

/**
 * DELETE /api/mails/delete-all
 * Delete all mails (with optional filters)
 * NOTE: This must come before /:id route
 */
router.delete('/delete-all', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { isRead, isStarred } = req.query;

    const filters: any = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === 'false'; // Delete unread mails
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === 'true';
    }

    const count = await mailService.deleteAllMails(userId, filters);

    res.json({
      success: true,
      count,
      message: `${count} mails deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete all mails',
      error: error.message,
    });
  }
}) as any);

/**
 * DELETE /api/mails/:id
 * Delete a mail (soft delete)
 */
router.delete('/:id', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const result = await mailService.deleteMail(mailId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Mail not found',
      });
    }

    res.json({
      success: true,
      message: 'Mail deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete mail',
      error: error.message,
    });
  }
}) as any);

/**
 * DELETE /api/mails
 * Delete multiple mails
 */
router.delete('/', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { mailIds } = req.body;

    if (!Array.isArray(mailIds) || mailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'mailIds array is required',
      });
    }

    const count = await mailService.deleteMultiple(mailIds, userId);

    res.json({
      success: true,
      count,
      message: `${count} mails deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete mails',
      error: error.message,
    });
  }
}) as any);

export default router;

