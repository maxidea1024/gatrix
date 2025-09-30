import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import db from '../config/knex';
import logger from '../config/logger';
import { SSENotificationService } from '../services/sseNotificationService';

export class AdminInvitationController {
  // 사용자 초대 생성
  static createInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 입력 검증
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, role = 'user', expirationHours = 168 } = req.body; // 기본값: 168시간(7일)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // 이미 등록된 사용자인지 확인
    if (email) {
      const existingUser = await UserModel.findByEmailWithoutPassword(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
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

    // SSE를 통한 실시간 전파
    try {
      const sseService = SSENotificationService.getInstance();
      sseService.sendNotification({
        type: 'invitation_created',
        data: {
          invitation: invitationData,
          inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?invite=${token}`
        },
        targetChannels: ['admin'],
        timestamp: new Date()
      });
      logger.info(`SSE notification sent for invitation creation: ${invitationId}`);
    } catch (sseError) {
      logger.error('Failed to send SSE notification for invitation creation:', sseError);
      // SSE 실패해도 응답은 정상적으로 보냄
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

      if (!activeInvitation) {
        return res.status(404).json({
          success: false,
          error: 'No active invitation'
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
          error: 'Invitation not found'
        });
      }

      await db('g_invitations')
        .where('id', id)
        .del();

      // SSE를 통한 실시간 전파
      try {
        const sseService = SSENotificationService.getInstance();
        sseService.sendNotification({
          type: 'invitation_deleted',
          data: {
            invitationId: id,
            invitation: invitation
          },
          targetChannels: ['admin'],
          timestamp: new Date()
        });
        logger.info(`SSE notification sent for invitation deletion: ${id}`);
      } catch (sseError) {
        logger.error('Failed to send SSE notification for invitation deletion:', sseError);
        // SSE 실패해도 응답은 정상적으로 보냄
      }

      res.json({
        success: true,
        message: 'Invitation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting invitation:', error);
      res.status(500).json({
        success: false,
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

