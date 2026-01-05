import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import db from '../config/knex';
import logger from '../config/logger';
import { pubSubService } from '../services/PubSubService';

export class AdminInvitationController {
  // 사용자 초대 생성
  static createInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 입력 검증
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, role = 'user', expirationHours = 168 } = req.body; // 기본값: 168시간(7일)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'User not authenticated'
      });
    }

    // 이미 등록된 사용자인지 확인
    if (email) {
      const existingUser = await UserModel.findByEmailWithoutPassword(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          code: 'USER_ALREADY_EXISTS',
          error: 'A user with this email already exists'
        });
      }
    }

    // 이메일이 제공된 경우에만 기존 초대 확인
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
          error: 'An active invitation already exists for this email'
        });
      }
    }

    // 새 초대 생성
    const invitationId = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + (expirationHours * 60 * 60 * 1000)); // 설정된 시간 후 만료

    await db('g_invitations').insert({
      id: invitationId,
      token,
      email: email || null, // 이메일이 없으면 null로 저장
      role,
      createdBy: userId,
      createdAt: new Date(),
      expiresAt,
      isActive: true
    });

    const invitationData = {
      id: invitationId,
      token,
      email,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: userId.toString(),
      isActive: true
    };

    // PubSub을 통해 모든 인스턴스가 수신 후 각자 SSE로 전파 (자신 제외)
    try {
      await pubSubService.publishNotification({
        type: 'invitation_created',
        data: {
          invitation: invitationData,
          inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?invite=${token}`
        },
        targetChannels: ['admin'],
        excludeUsers: [req.user!.id], // 자신은 제외
      });
      logger.info(`PubSub notification queued for invitation creation: ${invitationId}`);
    } catch (err) {
      logger.error('Failed to enqueue PubSub notification for invitation creation:', err);
      // 실패해도 초대 생성 응답은 정상 반환
    }

    res.status(201).json({
      success: true,
      invitation: invitationData,
      inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?invite=${token}`,
      message: 'Invitation created successfully'
    });
  });

  // 현재 활성 초대 조회
  static getCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activeInvitation = await db('g_invitations')
        .select(['id', 'token', 'email', 'role', 'expiresAt', 'createdAt', 'createdBy', 'isActive'])
        .where('isActive', true)
        .where('expiresAt', '>', new Date())
        .orderBy('createdAt', 'desc')
        .first(); // 가장 최근의 활성 초대 하나만 가져오기

      // Return 200 with null data if no active invitation exists (not an error)
      if (!activeInvitation) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: {
          id: activeInvitation.id,
          token: activeInvitation.token,
          email: activeInvitation.email,
          role: activeInvitation.role,
          createdAt: activeInvitation.createdAt,
          expiresAt: activeInvitation.expiresAt,
          createdBy: activeInvitation.createdBy,
          isActive: activeInvitation.isActive
        }
      });
    } catch (error) {
      logger.error('Error fetching current invitations:', error);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Failed to fetch current invitations'
      });
    }
  });

  // 초대 목록 조회
  static getInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allInvitations = await db('g_invitations')
        .select(['id', 'token', 'email', 'role', 'expiresAt', 'createdAt', 'createdBy', 'isActive'])
        .orderBy('createdAt', 'desc');

      res.json({
        success: true,
        data: allInvitations.map(inv => ({
          id: inv.id,
          token: inv.token,
          email: inv.email,
          role: inv.role,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          createdBy: inv.createdBy,
          isActive: inv.isActive,
          isExpired: new Date(inv.expiresAt) <= new Date()
        }))
      });
    } catch (error) {
      logger.error('Error fetching invitations:', error);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Failed to fetch invitations'
      });
    }
  });

  // 초대 삭제
  static deleteInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
      const invitation = await db('g_invitations')
        .where('id', id)
        .first();

      if (!invitation) {
        return res.status(404).json({
          success: false,
          code: 'INVITATION_NOT_FOUND',
          error: 'Invitation not found'
        });
      }

      await db('g_invitations')
        .where('id', id)
        .del();

      // PubSub을 통해 모든 인스턴스가 수신 후 각자 SSE로 전파 (자신 제외)
      try {
        await pubSubService.publishNotification({
          type: 'invitation_deleted',
          data: {
            invitationId: id,
            invitation: invitation
          },
          targetChannels: ['admin'],
          excludeUsers: [req.user!.id], // 자신은 제외
        });
        logger.info(`PubSub notification queued for invitation deletion: ${id}`);
      } catch (err) {
        logger.error('Failed to enqueue PubSub notification for invitation deletion:', err);
        // 실패해도 응답은 정상적으로 보냄
      }

      res.json({
        success: true,
        code: 'INVITATION_DELETED',
        message: 'Invitation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting invitation:', error);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Failed to delete invitation'
      });
    }
  });
}

// 입력 검증 미들웨어
export const createInvitationValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required when provided')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin'),
  body('expirationHours')
    .optional()
    .isInt({ min: 1, max: 8760 }) // 최소 1시간, 최대 1년(365*24)
    .withMessage('Expiration hours must be between 1 and 8760 (1 year)')
];
