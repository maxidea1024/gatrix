import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import logger from '../config/logger';
import { config } from '../config';

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

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>비밀번호 재설정</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #5b6ad0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #5b6ad0; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Gatrix - 비밀번호 재설정</h1>
          </div>
          <div class="content">
            <h2>비밀번호 재설정 요청</h2>
            <p>안녕하세요,</p>
            <p>Gatrix 계정의 비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">비밀번호 재설정</a>
            </p>
            <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
            <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            <p><strong>이 링크는 1시간 후에 만료됩니다.</strong></p>
            <p>만약 비밀번호 재설정을 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.</p>
          </div>
          <div class="footer">
            <p>© 2025 Motif Games. All rights reserved.</p>
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Gatrix - 비밀번호 재설정

안녕하세요,

Gatrix 계정의 비밀번호 재설정을 요청하셨습니다. 
다음 링크를 클릭하여 새로운 비밀번호를 설정해주세요:

${resetUrl}

이 링크는 1시간 후에 만료됩니다.

만약 비밀번호 재설정을 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.

© 2025 Motif Games. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Gatrix - 비밀번호 재설정',
      html,
      text,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gate에 오신 것을 환영합니다</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #5b6ad0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Gate에 오신 것을 환영합니다!</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>Gatrix 온라인 게임 플랫폼에 가입해주셔서 감사합니다.</p>
            <p>이제 다양한 게임과 기능을 즐기실 수 있습니다:</p>
            <ul>
              <li>개인화된 대시보드</li>
              <li>게임 통계 및 분석</li>
              <li>커뮤니티 기능</li>
              <li>프로필 관리</li>
            </ul>
            <p>궁금한 점이 있으시면 언제든지 문의해주세요.</p>
            <p>즐거운 게임 되세요!</p>
          </div>
          <div class="footer">
            <p>© 2025 Motif Games. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Gate에 오신 것을 환영합니다!',
      html,
    });
  }

  async sendAccountApprovalEmail(email: string, name: string): Promise<boolean> {
    const loginUrl = `${config.frontendUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gatrix 계정 승인 완료</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4caf50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4caf50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 계정 승인 완료!</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p><strong>좋은 소식이 있습니다!</strong></p>
            <p>Gatrix 계정이 관리자에 의해 승인되었습니다. 이제 모든 기능을 사용하실 수 있습니다.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" class="button">지금 로그인하기</a>
            </div>

            <p><strong>이제 다음 기능들을 이용하실 수 있습니다:</strong></p>
            <ul>
              <li>개인화된 대시보드 접근</li>
              <li>프로필 관리 및 설정</li>
              <li>모든 게임 기능 이용</li>
              <li>커뮤니티 참여</li>
            </ul>

            <p>Gate에 오신 것을 진심으로 환영합니다!</p>
            <p>궁금한 점이 있으시면 언제든지 문의해주세요.</p>
          </div>
          <div class="footer">
            <p>© 2025 Motif Games. All rights reserved.</p>
            <p>이 이메일은 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Gatrix - 계정 승인 완료

안녕하세요, ${name}님!

좋은 소식이 있습니다!
Gatrix 계정이 관리자에 의해 승인되었습니다. 이제 모든 기능을 사용하실 수 있습니다.

로그인하기: ${loginUrl}

이제 다음 기능들을 이용하실 수 있습니다:
- 개인화된 대시보드 접근
- 프로필 관리 및 설정
- 모든 게임 기능 이용
- 커뮤니티 참여

Gate에 오신 것을 진심으로 환영합니다!

© 2025 Motif Games. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: '🎉 Gatrix 계정 승인 완료 - 이제 로그인하세요!',
      html,
      text,
    });
  }
}

export default EmailService.getInstance();
