import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/async-handler';
import db from '../config/knex';
import { UserModel } from '../models/user';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { UserOnboardingService } from '../services/user-onboarding-service';

import { createLogger } from '../config/logger';
const logger = createLogger('PublicInvitationController');

export class PublicInvitationController {
  // 초대 Verify token (Public API)
  static validateInvitation = asyncHandler(
    async (req: Request, res: Response) => {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Invitation token is required',
        });
      }

      try {
        // 초대 정보 조회
        const invitation = await db('g_invitations')
          .select([
            'id',
            'token',
            'email',
            'role',
            'expiresAt',
            'createdAt',
            'isActive',
            'autoJoinConfig',
          ])
          .where('token', token)
          .where('isActive', true)
          .first();

        if (!invitation) {
          return res.status(404).json({
            success: false,
            error: 'Invitation not found or inactive',
          });
        }

        // Expired Confirm
        const now = new Date();
        const expiresAt = new Date(invitation.expiresAt);

        if (expiresAt <= now) {
          return res.status(400).json({
            success: false,
            error: 'Invitation has expired',
          });
        }

        // 이미 Used된 초대인지 Confirm
        if (invitation.usedAt) {
          return res.status(400).json({
            success: false,
            error: 'Invitation has already been used',
          });
        }

        // Resolve autoJoinConfig to display names for invitee
        let autoJoinInfo = null;
        if (invitation.autoJoinConfig) {
          const config =
            typeof invitation.autoJoinConfig === 'string'
              ? JSON.parse(invitation.autoJoinConfig)
              : invitation.autoJoinConfig;
          autoJoinInfo =
            await UserOnboardingService.resolveAutoJoinConfigNames(config);
        }

        res.json({
          success: true,
          data: {
            valid: true,
            invitation: {
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              createdAt: invitation.createdAt,
              expiresAt: invitation.expiresAt,
            },
            autoJoinInfo,
          },
        });
      } catch (error) {
        logger.error('Failed to validate invitation:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  );

  // 초대 수락 및 Used자 Register (Public API)
  static acceptInvitation = asyncHandler(
    async (req: Request, res: Response) => {
      // 입력 Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { token } = req.params;
      const { username, password, email, fullName } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Invitation token is required',
        });
      }

      try {
        // 초대 정보 조회 및 Validation
        const invitation = await db('g_invitations')
          .select([
            'id',
            'token',
            'email',
            'role',
            'expiresAt',
            'createdAt',
            'isActive',
            'usedAt',
            'autoJoinConfig',
          ])
          .where('token', token)
          .where('isActive', true)
          .first();

        if (!invitation) {
          return res.status(404).json({
            success: false,
            error: 'Invitation not found or inactive',
          });
        }

        // Expired Confirm
        const now = new Date();
        const expiresAt = new Date(invitation.expiresAt);

        if (expiresAt <= now) {
          return res.status(400).json({
            success: false,
            error: 'Invitation has expired',
          });
        }

        // 이미 Used된 초대인지 Confirm
        if (invitation.usedAt) {
          return res.status(400).json({
            success: false,
            error: 'Invitation has already been used',
          });
        }

        // 이메일이 초대에 지정된 경우 일치하는지 Confirm
        if (invitation.email && invitation.email !== email) {
          return res.status(400).json({
            success: false,
            error: 'Email does not match the invitation',
          });
        }

        // 이미 Register된 Used자인지 Confirm
        const existingUser = await UserModel.findByEmailWithoutPassword(email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'A user with this email already exists',
          });
        }

        // Used자명 중복 Confirm
        const existingUsername = await db('g_users')
          .select('id')
          .where('name', username)
          .first();
        if (existingUsername) {
          return res.status(409).json({
            success: false,
            error: 'Username is already taken',
          });
        }

        // 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(password, 12);

        // Transaction: create user, mark invitation used, apply auto-join
        await db.transaction(async (trx: Knex.Transaction) => {
          // Create user
          const userId = uuidv4();
          await trx('g_users').insert({
            id: userId,
            name: username,
            email: email,
            password: hashedPassword,
            fullName: fullName || username,
            role: invitation.role || 'user',
            status: 'active', // 초대를 통한 가입은 바로 Active화
            emailVerified: true, // 초대를 통한 가입은 이메일 Authentication 완료로 처리
            createdAt: now,
            updatedAt: now,
          });

          // Mark invitation as used
          await trx('g_invitations').where('id', invitation.id).update({
            usedAt: now,
            usedBy: userId,
            updatedAt: now,
          });

          // Apply auto-join config if present
          if (invitation.autoJoinConfig) {
            const config =
              typeof invitation.autoJoinConfig === 'string'
                ? JSON.parse(invitation.autoJoinConfig)
                : invitation.autoJoinConfig;
            await UserOnboardingService.applyAutoJoinConfig(
              userId,
              config,
              invitation.createdBy || userId
            );
          }
        });

        res.status(201).json({
          success: true,
          message: 'User registered successfully through invitation',
        });
      } catch (error) {
        logger.error('Failed to accept invitation:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  );
}

// 초대 수락 Validation 규칙
export const acceptInvitationValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),

  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must not exceed 100 characters'),
];
