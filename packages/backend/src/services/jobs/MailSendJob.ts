import nodemailer from 'nodemailer';
import { BaseJob, JobExecutionResult } from './JobFactory';
import logger from '../../config/logger';

export class MailSendJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    try {
      // 필수 필드 검증
      this.validateRequiredFields(['to', 'subject', 'body']);

      const { to, cc, bcc, subject, body, attachments } = this.context.jobDataMap;

      // 메일 전송 설정 (환경변수에서 가져오기)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // 메일 옵션 구성
      const mailOptions: any = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: body,
      };

      if (cc) {
        mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
      }

      if (bcc) {
        mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      }

      if (attachments && Array.isArray(attachments)) {
        mailOptions.attachments = attachments.map((attachment) => ({
          filename: attachment.filename,
          path: attachment.path || undefined,
          content: attachment.content || undefined,
          contentType: attachment.contentType || undefined,
        }));
      }

      // 메일 전송
      const info = await transporter.sendMail(mailOptions);

      logger.info(`Mail sent successfully`, {
        jobId: this.context.jobId,
        messageId: info.messageId,
        to: mailOptions.to,
        subject,
      });

      return {
        success: true,
        data: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
        executionTimeMs: 0, // Will be set by executeWithTimeout
      };
    } catch (error) {
      logger.error(`Mail send job failed`, {
        jobId: this.context.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}
