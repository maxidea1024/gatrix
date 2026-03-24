import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/async-handler';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/user';
import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('AdminInvitationController');
import { pubSubService } from '../services/pub-sub-service';

export class AdminInvitationController {
  // Create user invitation
  static createInvitation = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, expirationHours = 168, autoJoinConfig } = req.body; // Default: 168 hours (7 days)
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          error: 'User not authenticated',
        });
      }

      // Check if user is already registered
      if (email) {
        const existingUser = await UserModel.findByEmailWithoutPassword(email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            code: 'USER_ALREADY_EXISTS',
            error: 'A user with this email already exists',
          });
        }
      }

      // Check for existing invitation only if email is provided
      if (email) {
        const existingInvitation = await db('g_invitations')
          .where('email', email)
          .where('isActive', true)
          .where('expiresAt', '>', new Date())
          .first();

        if (existingInvitation) {
          return res.status(409).json({
            success: false,
            code: 'ACTIVE_INVITATION_EXISTS',
            error: 'An active invitation already exists for this email',
          });
        }
      }

      // Create new invitation
      const invitationId = uuidv4();
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + expirationHours * 60 * 60 * 1000); // Expires after configured hours

      await db('g_invitations').insert({
        id: invitationId,
        token,
        email: email || null, // Save as null if no email
        createdBy: userId,
        createdAt: new Date(),
        expiresAt,
        isActive: true,
        autoJoinConfig: autoJoinConfig ? JSON.stringify(autoJoinConfig) : null,
      });

      const invitationData = {
        id: invitationId,
        token,
        email,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: userId.toString(),
        isActive: true,
        autoJoinConfig: autoJoinConfig || null,
      };

      // Broadcast via PubSub to all instances for SSE propagation (exclude self)
      try {
        await pubSubService.publishNotification({
          type: 'invitation_created',
          data: {
            invitation: invitationData,
            inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?invite=${token}`,
          },
          targetChannels: ['admin'],
          excludeUsers: [req.user!.id], // Exclude self
        });
        logger.info(
          `PubSub notification queued for invitation creation: ${invitationId}`
        );
      } catch (err) {
        logger.error(
          'Failed to enqueue PubSub notification for invitation creation:',
          err
        );
        // Return success even if notification fails
      }

      res.status(201).json({
        success: true,
        invitation: invitationData,
        inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?invite=${token}`,
        message: 'Invitation created successfully',
      });
    }
  );

  // Get currently active invitation
  static getCurrent = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const activeInvitation = await db('g_invitations')
          .select([
            'id',
            'token',
            'email',
            'expiresAt',
            'createdAt',
            'createdBy',
            'isActive',
          ])
          .where('isActive', true)
          .where('expiresAt', '>', new Date())
          .orderBy('createdAt', 'desc')
          .first(); // Get only the most recent active invitation

        // Return 200 with null data if no active invitation exists (not an error)
        if (!activeInvitation) {
          return res.json({
            success: true,
            data: null,
          });
        }

        res.json({
          success: true,
          data: {
            id: activeInvitation.id,
            token: activeInvitation.token,
            email: activeInvitation.email,
            createdAt: activeInvitation.createdAt,
            expiresAt: activeInvitation.expiresAt,
            createdBy: activeInvitation.createdBy,
            isActive: activeInvitation.isActive,
          },
        });
      } catch (error) {
        logger.error('Error fetching current invitations:', error);
        res.status(500).json({
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: 'Failed to fetch current invitations',
        });
      }
    }
  );

  // Get invitation list
  static getInvitations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const allInvitations = await db('g_invitations')
          .select([
            'id',
            'token',
            'email',
            'expiresAt',
            'createdAt',
            'createdBy',
            'isActive',
          ])
          .orderBy('createdAt', 'desc');

        res.json({
          success: true,
          data: allInvitations.map((inv) => ({
            id: inv.id,
            token: inv.token,
            email: inv.email,
            createdAt: inv.createdAt,
            expiresAt: inv.expiresAt,
            createdBy: inv.createdBy,
            isActive: inv.isActive,
            isExpired: new Date(inv.expiresAt) <= new Date(),
          })),
        });
      } catch (error) {
        logger.error('Error fetching invitations:', error);
        res.status(500).json({
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: 'Failed to fetch invitations',
        });
      }
    }
  );

  // Delete invitation
  static deleteInvitation = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      try {
        const invitation = await db('g_invitations').where('id', id).first();

        if (!invitation) {
          return res.status(404).json({
            success: false,
            code: 'INVITATION_NOT_FOUND',
            error: 'Invitation not found',
          });
        }

        await db('g_invitations').where('id', id).del();

        // Broadcast via PubSub to all instances for SSE propagation (exclude self)
        try {
          await pubSubService.publishNotification({
            type: 'invitation_deleted',
            data: {
              invitationId: id,
              invitation: invitation,
            },
            targetChannels: ['admin'],
            excludeUsers: [req.user!.id], // Exclude self
          });
          logger.info(
            `PubSub notification queued for invitation deletion: ${id}`
          );
        } catch (err) {
          logger.error(
            'Failed to enqueue PubSub notification for invitation deletion:',
            err
          );
          // Return success even if notification fails
        }

        res.json({
          success: true,
          code: 'INVITATION_DELETED',
          message: 'Invitation deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting invitation:', error);
        res.status(500).json({
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: 'Failed to delete invitation',
        });
      }
    }
  );
}

// Input validation middleware
export const createInvitationValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required when provided')
    .normalizeEmail(),

  body('expirationHours')
    .optional()
    .isInt({ min: 1, max: 8760 }) // Min 1 hour, max 1 year (365*24)
    .withMessage('Expiration hours must be between 1 and 8760 (1 year)'),

  body('autoJoinConfig')
    .optional()
    .isObject()
    .withMessage('autoJoinConfig must be a valid object'),
];
