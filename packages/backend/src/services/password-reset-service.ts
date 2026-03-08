import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/knex';
import emailService from './email-service';
import { createLogger } from '../config/logger';

const logger = createLogger('PasswordResetService');

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PasswordResetService {
  private static instance: PasswordResetService;

  private constructor() {}

  public static getInstance(): PasswordResetService {
    if (!PasswordResetService.instance) {
      PasswordResetService.instance = new PasswordResetService();
    }
    return PasswordResetService.instance;
  }

  async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Used자 Confirm
      const user = await db('g_users')
        .select('id', 'email', 'name', 'authType')
        .where('email', email)
        .where('status', 'active')
        .first();

      if (!user) {
        // Register되지 않은 이메일에 대한 오류 반환
        return {
          success: false,
          message: 'EMAIL_NOT_REGISTERED',
        };
      }

      // authType이 local이 아닌 경우 비밀번호 리셋 불가
      if (user.authType !== 'local') {
        return {
          success: false,
          message: 'PASSWORD_RESET_NOT_AVAILABLE_FOR_OAUTH_USERS',
        };
      }

      // Existing 미Used 토큰들을 Expired시킴
      await db('g_password_reset_tokens')
        .where('userId', user.id)
        .where('used', false)
        .update({ used: true });

      // 새 리셋 토큰 Create (32바이트 랜덤 문자열)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 Expired

      // 토큰을 데이터베이스에 Save
      await db('g_password_reset_tokens').insert({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // 이메일 발송
      const emailSent = await emailService.sendPasswordResetEmail(
        email,
        resetToken
      );

      if (!emailSent) {
        logger.error('Failed to send password reset email', { email });
        return {
          success: false,
          message: 'EMAIL_SEND_FAILED',
        };
      }

      logger.info('Password reset email sent', { email, userId: user.id });

      return {
        success: true,
        message: 'PASSWORD_RESET_EMAIL_SENT',
      };
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      return {
        success: false,
        message: 'PASSWORD_RESET_REQUEST_ERROR',
      };
    }
  }

  async validateResetToken(
    token: string
  ): Promise<{ valid: boolean; userId?: string; message: string }> {
    try {
      const resetToken = await db('g_password_reset_tokens')
        .select('id', 'userId', 'expiresAt', 'used')
        .where('token', token)
        .where('used', false)
        .first();

      if (!resetToken) {
        return {
          valid: false,
          message: 'INVALID_TOKEN',
        };
      }

      // Expired Confirm
      if (new Date() > new Date(resetToken.expiresAt)) {
        return {
          valid: false,
          message: 'TOKEN_EXPIRED',
        };
      }

      return {
        valid: true,
        userId: resetToken.userId,
        message: 'VALID_TOKEN',
      };
    } catch (error) {
      logger.error('Error validating reset token:', error);
      return {
        valid: false,
        message: 'TOKEN_VALIDATION_ERROR',
      };
    }
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify token
      const validation = await this.validateResetToken(token);
      if (!validation.valid || !validation.userId) {
        return {
          success: false,
          message: validation.message,
        };
      }

      // 새 비밀번호 해시
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // 트랜잭션으로 비밀번호 업데이트 및 토큰 Used 처리
      await db.transaction(async (trx) => {
        // 비밀번호 업데이트
        await trx('g_users').where('id', validation.userId).update({
          passwordHash: hashedPassword,
        });

        // 토큰을 Used됨으로 표시
        await trx('g_password_reset_tokens').where('token', token).update({
          used: true,
        });

        // 해당 Used자의 다른 Mark all tokens as used
        await trx('g_password_reset_tokens')
          .where('userId', validation.userId)
          .where('used', false)
          .update({
            used: true,
          });
      });

      logger.info('Password reset successful', { userId: validation.userId });

      return {
        success: true,
        message: 'PASSWORD_RESET_SUCCESS',
      };
    } catch (error) {
      logger.error('Error resetting password:', error);
      return {
        success: false,
        message: 'PASSWORD_RESET_ERROR',
      };
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      const deletedCount = await db('g_password_reset_tokens')
        .where('expiresAt', '<', db.raw('UTC_TIMESTAMP()'))
        .orWhere('used', true)
        .del();

      logger.info('Cleaned up expired password reset tokens', { deletedCount });
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }
}

export default PasswordResetService.getInstance();
