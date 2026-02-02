import express, { Response } from "express";
import { mailService } from "../services/MailService";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { MailType, MailPriority } from "../models/Mail";
import { pubSubService } from "../services/PubSubService";
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from "../utils/apiResponse";

const router = express.Router();

// All routes require authentication
router.use(authenticate as any);

/**
 * GET /api/mails
 * Get mails for the current user
 */
router.get("/", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Add 2 second delay for testing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const userId = req.user!.userId;
    const {
      isRead,
      isStarred,
      mailType,
      category,
      page = "1",
      limit = "20",
    } = req.query;

    const filters: any = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    if (isRead !== undefined) {
      filters.isRead = isRead === "true";
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === "true";
    }
    if (mailType) {
      filters.mailType = mailType as MailType;
    }
    if (category) {
      filters.category = category as string;
    }

    const result = await mailService.getMailsForUser(userId, filters);

    return sendSuccessResponse(res, {
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get mails",
      error,
      ErrorCodes.MAIL_NOT_FOUND,
    );
  }
}) as any);

/**
 * GET /api/mails/sent
 * Get sent mails for the current user
 */
router.get("/sent", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Add 2 second delay for testing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const userId = req.user!.userId;
    const { page = "1", limit = "20" } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    const result = await mailService.getSentMailsForUser(userId, options);

    return sendSuccessResponse(res, {
      data: result.data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / options.limit),
      },
    });
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get sent mails",
      error,
      ErrorCodes.MAIL_NOT_FOUND,
    );
  }
}) as any);

/**
 * GET /api/mails/unread-count
 * Get unread mail count for the current user
 */
router.get("/unread-count", (async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const count = await mailService.getUnreadCount(userId);

    return sendSuccessResponse(res, { count });
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get unread count",
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED,
    );
  }
}) as any);

/**
 * GET /api/mails/stats
 * Get mail statistics for the current user
 */
router.get("/stats", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await mailService.getMailStats(userId);

    return sendSuccessResponse(res, stats);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get mail stats",
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED,
    );
  }
}) as any);

/**
 * GET /api/mails/:id
 * Get a single mail by ID
 */
router.get("/:id", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const mail = await mailService.getMailById(mailId, userId);

    if (!mail) {
      return sendNotFound(res, "Mail not found", ErrorCodes.MAIL_NOT_FOUND);
    }

    return sendSuccessResponse(res, mail);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get mail",
      error,
      ErrorCodes.MAIL_NOT_FOUND,
    );
  }
}) as any);

/**
 * POST /api/mails
 * Send a new mail
 */
router.post("/", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      recipientId,
      subject,
      content,
      contentType = "text",
      priority = "normal",
      category,
      mailData,
    } = req.body;

    // Validation
    if (!recipientId || !subject || !content) {
      return sendBadRequest(
        res,
        "recipientId, subject, and content are required",
        {
          fields: ["recipientId", "subject", "content"],
        },
      );
    }

    // Add 2 second delay for better UX (show loading state)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mail = await mailService.sendMail({
      senderId: userId,
      senderName: req.user!.email,
      recipientId,
      subject,
      content,
      contentType,
      mailType: "user",
      priority: priority as MailPriority,
      category,
      mailData,
    });

    // Send SSE notification to recipient
    await pubSubService.publishNotification({
      type: "mail_received",
      data: {
        mailId: mail.id,
        senderId: userId,
        senderName: req.user!.email,
        subject,
        priority,
      },
      targetUsers: [recipientId],
    });

    return sendSuccessResponse(res, mail, "Mail sent successfully", 201);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to send mail",
      error,
      ErrorCodes.MAIL_SEND_FAILED,
    );
  }
}) as any);

/**
 * PATCH /api/mails/:id/read
 * Mark a mail as read
 */
router.patch("/:id/read", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const result = await mailService.markAsRead(mailId, userId);

    if (!result) {
      return sendNotFound(res, "Mail not found", ErrorCodes.MAIL_NOT_FOUND);
    }

    return sendSuccessResponse(res, undefined, "Mail marked as read");
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to mark mail as read",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
}) as any);

/**
 * PATCH /api/mails/read-multiple
 * Mark multiple mails as read
 */
router.patch("/read-multiple", (async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const { mailIds } = req.body;

    if (!Array.isArray(mailIds) || mailIds.length === 0) {
      return sendBadRequest(res, "mailIds array is required", {
        field: "mailIds",
      });
    }

    const count = await mailService.markMultipleAsRead(mailIds, userId);

    return sendSuccessResponse(res, { count }, `${count} mails marked as read`);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to mark mails as read",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
}) as any);

/**
 * PATCH /api/mails/read-all
 * Mark all unread mails as read (with optional filters)
 */
router.patch("/read-all", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { isRead, isStarred } = req.query;

    const filters: any = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === "false"; // Only mark unread mails
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === "true";
    }

    const count = await mailService.markAllAsRead(userId, filters);

    return sendSuccessResponse(res, { count }, `${count} mails marked as read`);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to mark all mails as read",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
}) as any);

/**
 * PATCH /api/mails/:id/star
 * Toggle starred status
 */
router.patch("/:id/star", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const isStarred = await mailService.toggleStarred(mailId, userId);

    return sendSuccessResponse(
      res,
      { isStarred },
      isStarred ? "Mail starred" : "Mail unstarred",
    );
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to toggle starred status",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
}) as any);

/**
 * DELETE /api/mails/delete-all
 * Delete all mails (with optional filters)
 * NOTE: This must come before /:id route
 */
router.delete("/delete-all", (async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const { isRead, isStarred } = req.query;

    const filters: any = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === "false"; // Delete unread mails
    }
    if (isStarred !== undefined) {
      filters.isStarred = isStarred === "true";
    }

    const count = await mailService.deleteAllMails(userId, filters);

    return sendSuccessResponse(
      res,
      { count },
      `${count} mails deleted successfully`,
    );
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to delete all mails",
      error,
      ErrorCodes.RESOURCE_DELETE_FAILED,
    );
  }
}) as any);

/**
 * DELETE /api/mails/:id
 * Delete a mail (soft delete)
 */
router.delete("/:id", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mailId = parseInt(req.params.id, 10);

    const result = await mailService.deleteMail(mailId, userId);

    if (!result) {
      return sendNotFound(res, "Mail not found", ErrorCodes.MAIL_NOT_FOUND);
    }

    return sendSuccessResponse(res, undefined, "Mail deleted successfully");
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to delete mail",
      error,
      ErrorCodes.RESOURCE_DELETE_FAILED,
    );
  }
}) as any);

/**
 * DELETE /api/mails
 * Delete multiple mails
 */
router.delete("/", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { mailIds } = req.body;

    if (!Array.isArray(mailIds) || mailIds.length === 0) {
      return sendBadRequest(res, "mailIds array is required", {
        field: "mailIds",
      });
    }

    const count = await mailService.deleteMultiple(mailIds, userId);

    return sendSuccessResponse(
      res,
      { count },
      `${count} mails deleted successfully`,
    );
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to delete mails",
      error,
      ErrorCodes.RESOURCE_DELETE_FAILED,
    );
  }
}) as any);

export default router;
