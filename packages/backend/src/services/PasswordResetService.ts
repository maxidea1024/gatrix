import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/knex';
import emailService from './EmailService';
import logger from '../config/logger';

export interface PasswordResetToken {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PasswordResetService {
  private static instance: PasswordResetService;

  private constructor() { }

  public static getInstance(): PasswordResetService {
    if (!PasswordResetService.instance) {
      PasswordResetService.instance = new PasswordResetService();
    }
    return PasswordResetService.instance;
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // 사용자 확인
      const user = await db('g_users')
        .select('id', 'email', 'name')
        .where('email', email)
        .where('status', 'active')
        .first();

      if (!user) {
        // 보안상 사용자가 존재하지 않아도 성공 메시지 반환
        return {
          success: true,
          message: 'PASSWORD_RESET_EMAIL_SENT',
        };
      }

      // 기존 미사용 토큰들을 만료시킴
      await db('g_password_reset_tokens')
        .where('userId', user.id)
        .where('used', false)
        .update({ used: true });

      // 새 리셋 토큰 생성 (32바이트 랜덤 문자열)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

      // 토큰을 데이터베이스에 저장
      await db('g_password_reset_tokens').insert({
        userId: user.id,
        token: resetToken,
        expiresAt,
        createdAt: db.fn.now(),
        updatedAt: db.fn.now()
      });

      // 이메일 발송
      const emailSent = await emailService.sendPasswordResetEmail(email, resetToken);

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

  async validateResetToken(token: string): Promise<{ valid: boolean; userId?: number; message: string }> {
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

      // 만료 확인
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

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // 토큰 검증
      const validation = await this.validateResetToken(token);
      if (!validation.valid || !validation.userId) {
        return {
          success: false,
          message: validation.message,
        };
      }

      // 새 비밀번호 해시
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // 트랜잭션으로 비밀번호 업데이트 및 토큰 사용 처리
      await db.transaction(async (trx) => {
        // 비밀번호 업데이트
        await trx('g_users')
          .where('id', validation.userId)
          .update({
            passwordHash: hashedPassword,
            updatedAt: db.fn.now()
          });

        // 토큰을 사용됨으로 표시
        await trx('g_password_reset_tokens')
          .where('token', token)
          .update({
            used: true,
            updatedAt: db.fn.now()
          });

        // 해당 사용자의 다른 모든 토큰도 사용됨으로 표시
        await trx('g_password_reset_tokens')
          .where('userId', validation.userId)
          .where('used', false)
          .update({
            used: true,
            updatedAt: db.fn.now()
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
        .where('expiresAt', '<', db.fn.now())
        .orWhere('used', true)
        .del();

      logger.info('Cleaned up expired password reset tokens', { deletedCount });
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }
}

export default PasswordResetService.getInstance();
