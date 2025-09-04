import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import logger from '../config/logger';
import { config } from '../config';
import EmailTemplateService from './EmailTemplateService';
import { UserModel } from '../models/User';
import { SupportedLanguage } from '../types/user';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type EmailProvider = 'sendgrid' | 'smtp' | 'console';

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private emailProvider: EmailProvider = 'console';

  private constructor() {
    this.initializeEmailProvider();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeEmailProvider(): void {
    try {
      // SendGrid 설정 확인 (우선순위 1)
      if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.emailProvider = 'sendgrid';
        logger.info('Email provider initialized: SendGrid');
        return;
      }

      // SMTP 설정 확인 (우선순위 2)
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        this.emailProvider = 'smtp';
        logger.info('Email provider initialized: SMTP');
        return;
      }

      // 설정이 없는 경우 콘솔 출력 (개발용)
      this.emailProvider = 'console';
      logger.warn('No email provider configured. Emails will be logged to console.');
    } catch (error) {
      logger.error('Failed to initialize email provider:', error);
      this.emailProvider = 'console';
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      switch (this.emailProvider) {
        case 'sendgrid':
          return await this.sendEmailViaSendGrid(options);

        case 'smtp':
          return await this.sendEmailViaSMTP(options);

        case 'console':
        default:
          return this.logEmailToConsole(options);
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  private async sendEmailViaSendGrid(options: EmailOptions): Promise<boolean> {
    try {
      const fromEmail = process.env.SENDGRID_FROM || process.env.SENDGRID_VERIFIED_SENDER;

      if (!fromEmail) {
        throw new Error('SendGrid sender email not configured');
      }

      const msg = {
        to: options.to,
        from: fromEmail,
        subject: options.subject,
        html: options.html,
        ...(options.text && { text: options.text }),
      };

      await sgMail.send(msg);

      logger.info('Email sent successfully via SendGrid:', {
        to: options.to,
        subject: options.subject,
        provider: 'sendgrid',
      });

      return true;
    } catch (error) {
      logger.error('SendGrid email sending failed:', error);
      throw error;
    }
  }

  private async sendEmailViaSMTP(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        throw new Error('SMTP transporter not initialized');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully via SMTP:', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
        provider: 'smtp',
      });

      return true;
    } catch (error) {
      logger.error('SMTP email sending failed:', error);
      throw error;
    }
  }

  private logEmailToConsole(options: EmailOptions): boolean {
    logger.warn('Email provider not configured. Email would be sent:', {
      to: options.to,
      subject: options.subject,
      provider: 'console',
    });

    // 개발 환경에서는 콘솔에 이메일 내용 출력
    if (config.nodeEnv === 'development') {
      logger.info('\n=== EMAIL CONTENT (NO PROVIDER CONFIGURED) ===');
      logger.info(`To: ${options.to}`);
      logger.info(`Subject: ${options.subject}`);
      logger.info(`HTML: ${options.html}`);
      if (options.text) {
        logger.info(`Text: ${options.text}`);
      }
      logger.info('===============================================\n');
    }

    return true; // 개발 환경에서는 성공으로 처리
  }

  /**
   * Get user's preferred language by email
   */
  private async getUserLanguage(email: string): Promise<SupportedLanguage> {
    try {
      const user = await UserModel.findByEmailWithoutPassword(email);
      return user?.preferredLanguage || 'en';
    } catch (error) {
      logger.warn(`Failed to get user language for ${email}, defaulting to 'en'`, error);
      return 'en';
    }
  }

  /**
   * Send templated email with user's preferred language
   */
  async sendTemplatedEmail(
    email: string,
    templateName: string,
    templateData: any,
    customSubject?: string
  ): Promise<boolean> {
    try {
      // Get user's preferred language
      const language = await this.getUserLanguage(email);

      // Render template
      const rendered = await EmailTemplateService.renderTemplateWithFallback(
        templateName,
        language,
        templateData
      );

      // Send email
      return await this.sendEmail({
        to: email,
        subject: customSubject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      logger.error(`Failed to send templated email: ${templateName} to ${email}`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    return this.sendTemplatedEmail(email, 'password-reset', {
      resetUrl
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendTemplatedEmail(email, 'welcome', {
      name
    });
  }

  async sendAccountApprovalEmail(email: string, name: string): Promise<boolean> {
    const loginUrl = `${config.frontendUrl}/login`;

    return this.sendTemplatedEmail(email, 'account-approval', {
      name,
      loginUrl
    });
  }
}

export default EmailService.getInstance();
