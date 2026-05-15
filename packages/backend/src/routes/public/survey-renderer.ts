import express from 'express';
import path from 'path';
import fs from 'fs';
import Handlebars from 'handlebars';
import { SurveyTemplateService } from '../../services/survey-template-service';

const router = express.Router();

// ==================== Template Loading ====================

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  const source = fs.readFileSync(filePath, 'utf-8');
  return Handlebars.compile(source);
}

// Pre-compile templates at startup for performance
const surveyTemplate = loadTemplate('survey-renderer');
const errorTemplate = loadTemplate('survey-error');

// ==================== Routes ====================

/**
 * GET /api/v1/public/surveys/:templateId/render
 *
 * Public endpoint to render a survey template as a standalone HTML page.
 * Used by the in-game WebView to display custom surveys.
 *
 * Query params:
 *   - locale: Display language (ko, en, zh). Default: ko
 *   - roleId: Player role ID for tracking
 *   - gpId: Player account ID
 *   - envId: Environment ID to scope the template lookup
 */
router.get('/:templateId/render', async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    const locale = (req.query.locale as string) || 'ko';
    const roleId = (req.query.roleId as string) || '';
    const gpId = (req.query.gpId as string) || '';
    const envId = (req.query.envId as string) || '';

    if (!envId) {
      return res
        .status(400)
        .json({ success: false, message: 'envId is required' });
    }

    const template = await SurveyTemplateService.getTemplateById(
      templateId,
      envId
    );

    if (!template || !template.isPublished) {
      return res
        .status(404)
        .send(errorTemplate({ message: 'Survey not found' }));
    }

    const html = renderSurveyHtml(template, locale, roleId, gpId, envId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    console.error('Survey render error:', error);
    res.status(500).send(errorTemplate({ message: 'Internal server error' }));
  }
});

/**
 * POST /api/v1/public/surveys/:templateId/submit
 *
 * Receive survey responses from the in-game WebView.
 */
router.post(
  '/:templateId/submit',
  express.json(),
  async (req: any, res: any) => {
    try {
      const { templateId } = req.params;
      const { envId, roleId, gpId, answers, locale } = req.body;

      if (!envId || !templateId) {
        return res.status(400).json({
          success: false,
          message: 'envId and templateId are required',
        });
      }

      await SurveyTemplateService.submitResponse({
        environmentId: envId,
        surveyId: templateId,
        templateId,
        templateVersion: 1,
        accountId: roleId || gpId || 'anonymous',
        locale: locale || 'ko',
        answers: answers || {},
      });

      res.json({ success: true, message: 'Response recorded' });
    } catch (error: any) {
      console.error('Survey submit error:', error);
      res
        .status(500)
        .json({ success: false, message: 'Failed to submit response' });
    }
  }
);

// ==================== Helpers ====================

function renderSurveyHtml(
  template: any,
  locale: string,
  roleId: string,
  gpId: string,
  envId: string
): string {
  const questions = (template.questions || []).filter(
    (q: any) => q.type !== 'welcome' && q.type !== 'ending'
  );
  const welcomeBlock = (template.questions || []).find(
    (q: any) => q.type === 'welcome'
  );
  const endingBlock = (template.questions || []).find(
    (q: any) => q.type === 'ending'
  );
  const settings = template.settings || {};
  const locales = template.locales || {};
  const localeData = locales[locale] || {};

  const primaryColor = settings.theme?.primaryColor || '#6366f1';

  const templateData = {
    id: template.id,
    title: template.title,
    questions,
    welcomeBlock: welcomeBlock || null,
    endingBlock: endingBlock || null,
    primaryColor,
    submitText:
      localeData.submitButton ||
      (locale === 'ko' ? '제출' : locale === 'zh' ? '提交' : 'Submit'),
    nextText:
      localeData.nextButton ||
      (locale === 'ko' ? '다음' : locale === 'zh' ? '下一步' : 'Next'),
    prevText:
      localeData.prevButton ||
      (locale === 'ko' ? '이전' : locale === 'zh' ? '上一步' : 'Back'),
    thankYouText:
      localeData.thankYou ||
      (locale === 'ko'
        ? '감사합니다!'
        : locale === 'zh'
          ? '谢谢！'
          : 'Thank you!'),
    requiredText:
      localeData.requiredError ||
      (locale === 'ko'
        ? '필수 항목입니다'
        : locale === 'zh'
          ? '此字段为必填项'
          : 'This field is required'),
    showProgressBar: !!settings.showProgressBar,
    locale,
    roleId,
    gpId,
    envId,
    submitUrl: `/api/v1/public/surveys/${template.id}/submit`,
  };

  return surveyTemplate({
    locale,
    title: template.title,
    primaryColor,
    showProgressBar: !!settings.showProgressBar,
    templateDataJson: JSON.stringify(templateData),
  });
}

export default router;
