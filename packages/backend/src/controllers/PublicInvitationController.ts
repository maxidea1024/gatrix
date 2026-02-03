import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler';
import db from '../config/knex';
import { UserModel } from '../models/User';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

export class PublicInvitationController {
  // 초대 토큰 검증 (공개 API)
  static validateInvitation = asyncHandler(async (req: Request, res: Response) => {
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
        .select(['id', 'token', 'email', 'role', 'expiresAt', 'createdAt', 'isActive'])
        .where('token', token)
        .where('isActive', true)
        .first();

      if (!invitation) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found or inactive',
        });
      }

      // 만료 확인
      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);

      if (expiresAt <= now) {
        return res.status(400).json({
          success: false,
          error: 'Invitation has expired',
        });
      }

      // 이미 사용된 초대인지 확인
      if (invitation.usedAt) {
        return res.status(400).json({
          success: false,
          error: 'Invitation has already been used',
        });
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
        },
      });
    } catch (error) {
      console.error('Failed to validate invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // 초대 수락 및 사용자 등록 (공개 API)
  static acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
    // 입력 검증
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
      // 초대 정보 조회 및 검증
      const invitation = await db('g_invitations')
        .select(['id', 'token', 'email', 'role', 'expiresAt', 'createdAt', 'isActive', 'usedAt'])
        .where('token', token)
        .where('isActive', true)
        .first();

      if (!invitation) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found or inactive',
        });
      }

      // 만료 확인
      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);

      if (expiresAt <= now) {
        return res.status(400).json({
          success: false,
          error: 'Invitation has expired',
        });
      }

      // 이미 사용된 초대인지 확인
      if (invitation.usedAt) {
        return res.status(400).json({
          success: false,
          error: 'Invitation has already been used',
        });
      }

      // 이메일이 초대에 지정된 경우 일치하는지 확인
      if (invitation.email && invitation.email !== email) {
        return res.status(400).json({
          success: false,
          error: 'Email does not match the invitation',
        });
      }

      // 이미 등록된 사용자인지 확인
      const existingUser = await UserModel.findByEmailWithoutPassword(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'A user with this email already exists',
        });
      }

      // 사용자명 중복 확인
      const existingUsername = await db('g_users').select('id').where('name', username).first();
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: 'Username is already taken',
        });
      }

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(password, 12);

      // 트랜잭션으로 사용자 생성 및 초대 사용 처리
      await db.transaction(async (trx: Knex.Transaction) => {
        // 사용자 생성
        const userId = uuidv4();
        await trx('g_users').insert({
          id: userId,
          name: username,
          email: email,
          password: hashedPassword,
          fullName: fullName || username,
          role: invitation.role || 'user',
          status: 'active', // 초대를 통한 가입은 바로 활성화
          emailVerified: true, // 초대를 통한 가입은 이메일 인증 완료로 처리
          createdAt: now,
          updatedAt: now,
        });

        // 초대 사용 처리
        await trx('g_invitations').where('id', invitation.id).update({
          usedAt: now,
          usedBy: userId,
          updatedAt: now,
        });
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully through invitation',
      });
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}

// 초대 수락 검증 규칙
export const acceptInvitationValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),

  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),

  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must not exceed 100 characters'),
];
