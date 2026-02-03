import * as fs from 'fs';
import * as path from 'path';
import Handlebars, { TemplateDelegate } from 'handlebars';
import logger from '../config/logger';
import { SupportedLanguage } from '../types/user';

export interface EmailTemplateData {
  [key: string]: any;
}

export interface RenderedEmailTemplate {
  html: string;
  text?: string;
  subject: string;
}

export class EmailTemplateService {
  private static instance: EmailTemplateService;
  private templateCache: Map<string, TemplateDelegate> = new Map();
  private readonly templatesPath: string;

  private constructor() {
    this.templatesPath = path.join(__dirname, '../templates/email');
    this.setupHelpers();
  }

  public static getInstance(): EmailTemplateService {
    if (!EmailTemplateService.instance) {
      EmailTemplateService.instance = new EmailTemplateService();
    }
    return EmailTemplateService.instance;
  }

  /**
   * Setup Handlebars helpers for common functionality
   */
  private setupHelpers(): void {
    // Helper for formatting dates
    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      // Simple date formatting - you can enhance this with a proper date library
      return new Date(date).toLocaleDateString();
    });

    // Helper for conditional rendering
    Handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Helper for URL encoding
    Handlebars.registerHelper('urlEncode', (str: string) => {
      return encodeURIComponent(str || '');
    });
  }

  /**
   * Get template file path for a specific language and template
   */
  private getTemplatePath(
    templateName: string,
    language: SupportedLanguage,
    extension: 'hbs' | 'txt'
  ): string {
    return path.join(this.templatesPath, language, `${templateName}.${extension}`);
  }

  /**
   * Load and compile a template from file
   */
  private async loadTemplate(templatePath: string): Promise<TemplateDelegate> {
    const cacheKey = templatePath;

    // Check cache first
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      // Read and compile template
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = Handlebars.compile(templateContent);

      // Cache the compiled template
      this.templateCache.set(cacheKey, compiledTemplate);

      return compiledTemplate;
    } catch (error) {
      logger.error(`Failed to load template: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Get subject for email template based on template name and language
   */
  private getEmailSubject(templateName: string, language: SupportedLanguage): string {
    const subjects: Record<string, Record<SupportedLanguage, string>> = {
      'password-reset': {
        en: 'Gatrix - Password Reset',
        ko: 'Gatrix - 비밀번호 재설정',
        zh: 'Gatrix - 密码重置',
      },
      welcome: {
        en: 'Welcome to Gatrix!',
        ko: 'Gatrix에 오신 것을 환영합니다!',
        zh: '欢迎来到 Gatrix！',
      },
      'account-approval': {
        en: '🎉 Gatrix Account Approved - Login Now!',
        ko: '🎉 Gatrix 계정 승인 완료 - 이제 로그인하세요!',
        zh: '🎉 Gatrix 账户已批准 - 立即登录！',
      },
    };

    return subjects[templateName]?.[language] || `Gatrix - ${templateName}`;
  }

  /**
   * Render an email template with the given data
   */
  async renderTemplate(
    templateName: string,
    language: SupportedLanguage,
    data: EmailTemplateData
  ): Promise<RenderedEmailTemplate> {
    try {
      // Get template paths
      const htmlTemplatePath = this.getTemplatePath(templateName, language, 'hbs');
      const textTemplatePath = this.getTemplatePath(templateName, language, 'txt');

      // Load and render HTML template
      const htmlTemplate = await this.loadTemplate(htmlTemplatePath);
      const html = htmlTemplate(data);

      // Load and render text template (optional)
      let text: string | undefined;
      if (fs.existsSync(textTemplatePath)) {
        const textTemplate = await this.loadTemplate(textTemplatePath);
        text = textTemplate(data);
      }

      // Get subject
      const subject = this.getEmailSubject(templateName, language);

      return {
        html,
        text,
        subject,
      };
    } catch (error) {
      logger.error(`Failed to render email template: ${templateName} (${language})`, error);
      throw error;
    }
  }

  /**
   * Render template with fallback to default language if template not found
   */
  async renderTemplateWithFallback(
    templateName: string,
    preferredLanguage: SupportedLanguage,
    data: EmailTemplateData,
    fallbackLanguage: SupportedLanguage = 'en'
  ): Promise<RenderedEmailTemplate> {
    try {
      // Try preferred language first
      return await this.renderTemplate(templateName, preferredLanguage, data);
    } catch (error) {
      logger.warn(
        `Template not found for language ${preferredLanguage}, falling back to ${fallbackLanguage}`
      );

      try {
        // Fallback to default language
        return await this.renderTemplate(templateName, fallbackLanguage, data);
      } catch (fallbackError) {
        logger.error(`Failed to render template even with fallback language`, fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Clear template cache (useful for development)
   */
  clearCache(): void {
    this.templateCache.clear();
    logger.info('Email template cache cleared');
  }

  /**
   * Get available templates for a language
   */
  getAvailableTemplates(language: SupportedLanguage): string[] {
    const languagePath = path.join(this.templatesPath, language);

    if (!fs.existsSync(languagePath)) {
      return [];
    }

    return fs
      .readdirSync(languagePath)
      .filter((file) => file.endsWith('.hbs'))
      .map((file) => file.replace('.hbs', ''));
  }
}

export default EmailTemplateService.getInstance();
