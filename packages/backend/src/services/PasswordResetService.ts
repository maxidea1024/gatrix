import crypto from 'crypto';
import bcrypt from 'bcrypt';
import database from '../config/database';
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

  private constructor() {}

  public static getInstance(): PasswordResetService {
    if (!PasswordResetService.instance) {
      PasswordResetService.instance = new PasswordResetService();
    }
    return PasswordResetService.instance;
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // 사용자 확인
      const users = await database.query(
        'SELECT id, email, name FROM g_users WHERE email = ? AND status = "active"',
        [email]
      );

      if (users.length === 0) {
        // 보안상 사용자가 존재하지 않아도 성공 메시지 반환
        return {
          success: true,
          message: 'PASSWORD_RESET_EMAIL_SENT',
        };
      }

      const user = users[0];

      // 기존 미사용 토큰들을 만료시킴
      await database.query(
        'UPDATE g_password_reset_tokens SET used = TRUE WHERE userId = ? AND used = FALSE',
        [user.id]
      );

      // 새 리셋 토큰 생성 (32바이트 랜덤 문자열)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

      // 토큰을 데이터베이스에 저장
      await database.query(
        `INSERT INTO g_password_reset_tokens (userId, token, expiresAt, createdAt, updatedAt) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        [user.id, resetToken, expiresAt]
      );

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
      const tokens = await database.query(
        `SELECT id, userId, expiresAt, used 
         FROM g_password_reset_tokens 
         WHERE token = ? AND used = FALSE`,
        [token]
      );

      if (tokens.length === 0) {
        return {
          valid: false,
          message: 'INVALID_TOKEN',
        };
      }

      const resetToken = tokens[0];

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
      await database.transaction(async (connection) => {
        // 비밀번호 업데이트
        await connection.execute(
          'UPDATE g_users SET passwordHash = ?, updatedAt = NOW() WHERE id = ?',
          [hashedPassword, validation.userId]
        );

        // 토큰을 사용됨으로 표시
        await connection.execute(
          'UPDATE g_password_reset_tokens SET used = TRUE, updatedAt = NOW() WHERE token = ?',
          [token]
        );

        // 해당 사용자의 다른 모든 토큰도 사용됨으로 표시
        await connection.execute(
          'UPDATE g_password_reset_tokens SET used = TRUE, updatedAt = NOW() WHERE userId = ? AND used = FALSE',
          [validation.userId]
        );
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
      const result = await database.query(
        'DELETE FROM g_password_reset_tokens WHERE expiresAt < NOW() OR used = TRUE'
      );
      
      logger.info('Cleaned up expired password reset tokens', { deletedCount: result.affectedRows });
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }
}

export default PasswordResetService.getInstance();
