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
      // Find user by email
      const user = await db('g_users')
        .select('id', 'email', 'name', 'authType')
        .where('email', email)
        .where('status', 'active')
        .first();

      if (!user) {
        // Return error for unregistered email
        return {
          success: false,
          message: 'EMAIL_NOT_REGISTERED',
        };
      }

      // Password reset not available for non-local auth types
      if (user.authType !== 'local') {
        return {
          success: false,
          message: 'PASSWORD_RESET_NOT_AVAILABLE_FOR_OAUTH_USERS',
        };
      }

      // Expire existing unused tokens
      await db('g_password_reset_tokens')
        .where('userId', user.id)
        .where('used', false)
        .update({ used: true });

      // Create new reset token (32-byte random string)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Expires in 1 hour

      // Save token to database
      await db('g_password_reset_tokens').insert({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // Send email
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

      // Check expiration
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

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Transaction: update password, mark tokens as used, and unlock account
      await db.transaction(async (trx) => {
        // Update password and reset account lockout
        await trx('g_users').where('id', validation.userId).update({
          passwordHash: hashedPassword,
          failedLoginAttempts: 0,
          lockedAt: null,
        });

        // Mark token as used
        await trx('g_password_reset_tokens').where('token', token).update({
          used: true,
        });

        // Mark all other tokens for this user as used
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
