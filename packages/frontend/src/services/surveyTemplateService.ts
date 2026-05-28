import api from './api';

// ==================== Types ====================

export type QuestionType =
  | 'welcome'
  | 'single_choice'
  | 'multiple_choice'
  | 'short_text'
  | 'long_text'
  | 'rating'
  | 'linear_scale'
  | 'dropdown'
  | 'ending';

export interface LocalizedString {
  [locale: string]: string;
}

export interface QuestionOption {
  id: string;
  label: LocalizedString;
  value?: string;
}

export interface QuestionSettings {
  min?: number;
  max?: number;
  step?: number;
  icon?: string;
  maxLength?: number;
  maxSelections?: number;
  placeholder?: LocalizedString;
  minLabel?: LocalizedString;
  maxLabel?: LocalizedString;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: LocalizedString;
  description?: LocalizedString;
  required?: boolean;
  options?: QuestionOption[];
  settings?: QuestionSettings;
  pageId?: string;
}

export interface TemplateSettings {
  shuffleQuestions?: boolean;
  showProgressBar?: boolean;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

export interface TemplateLocales {
  [locale: string]: {
    submitButton?: string;
    nextButton?: string;
    prevButton?: string;
    thankYou?: string;
    requiredError?: string;
  };
}

export interface SurveyPage {
  id: string;
  title?: LocalizedString;
  questions: Question[];
}

// ==================== Page Helpers ====================

/**
 * Convert flat questions array (from DB) into structured pages.
 * Questions without pageId are grouped into a single default page.
 */
export function questionsToPages(questions: Question[]): SurveyPage[] {
  const regularQuestions = questions.filter(
    (q) => q.type !== 'welcome' && q.type !== 'ending'
  );

  // Group by pageId preserving order
  const pageMap = new Map<string, { questions: Question[]; order: number }>();
  let pageOrder = 0;

  for (const q of regularQuestions) {
    const pid = q.pageId || '__default__';
    if (!pageMap.has(pid)) {
      pageMap.set(pid, { questions: [], order: pageOrder++ });
    }
    pageMap.get(pid)!.questions.push(q);
  }

  // If no regular questions, create one empty default page with stable ID
  if (pageMap.size === 0) {
    return [{ id: 'page-default-0', questions: [] }];
  }

  // Convert map to sorted array
  // Use a deterministic ID for __default__ to avoid dirty-tracking issues
  const pages: SurveyPage[] = Array.from(pageMap.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([pid, data], idx) => ({
      id: pid === '__default__' ? `page-default-${idx}` : pid,
      questions: data.questions,
    }));

  return pages;
}

/**
 * Flatten structured pages back into a flat questions array for saving.
 * Stamps each question with its pageId. Welcome/ending blocks are prepended/appended.
 */
export function pagesToQuestions(
  pages: SurveyPage[],
  contentBlocks: Question[]
): Question[] {
  const welcome = contentBlocks.filter((q) => q.type === 'welcome');
  const ending = contentBlocks.filter((q) => q.type === 'ending');

  const pageQuestions = pages.flatMap((page) =>
    page.questions.map((q) => ({ ...q, pageId: page.id }))
  );

  return [...welcome, ...pageQuestions, ...ending];
}

export interface SurveyTemplate {
  id: string;
  environmentId: string;
  title: string;
  description?: string;
  questions: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  version: number;
  isPublished: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemplateInput {
  title: string;
  description?: string;
  questions: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  isPublished?: boolean;
}

export interface UpdateTemplateInput {
  title?: string;
  description?: string;
  questions?: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  isPublished?: boolean;
}

// ==================== Question Type Metadata ====================

export interface QuestionTypeMeta {
  type: QuestionType;
  labelKey: string;
  icon: string;
  hasOptions: boolean;
  hasSettings: boolean;
  category: 'content' | 'choice' | 'input' | 'scale';
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  {
    type: 'welcome',
    labelKey: 'surveyTemplate.questionTypes.welcome',
    icon: 'WavingHand',
    hasOptions: false,
    hasSettings: false,
    category: 'content',
  },
  {
    type: 'single_choice',
    labelKey: 'surveyTemplate.questionTypes.singleChoice',
    icon: 'RadioButtonChecked',
    hasOptions: true,
    hasSettings: false,
    category: 'choice',
  },
  {
    type: 'multiple_choice',
    labelKey: 'surveyTemplate.questionTypes.multipleChoice',
    icon: 'CheckBox',
    hasOptions: true,
    hasSettings: true,
    category: 'choice',
  },
  {
    type: 'short_text',
    labelKey: 'surveyTemplate.questionTypes.shortText',
    icon: 'ShortText',
    hasOptions: false,
    hasSettings: true,
    category: 'input',
  },
  {
    type: 'long_text',
    labelKey: 'surveyTemplate.questionTypes.longText',
    icon: 'Notes',
    hasOptions: false,
    hasSettings: true,
    category: 'input',
  },
  {
    type: 'rating',
    labelKey: 'surveyTemplate.questionTypes.rating',
    icon: 'Star',
    hasOptions: false,
    hasSettings: true,
    category: 'scale',
  },
  {
    type: 'linear_scale',
    labelKey: 'surveyTemplate.questionTypes.linearScale',
    icon: 'LinearScale',
    hasOptions: false,
    hasSettings: true,
    category: 'scale',
  },
  {
    type: 'dropdown',
    labelKey: 'surveyTemplate.questionTypes.dropdown',
    icon: 'ArrowDropDownCircle',
    hasOptions: true,
    hasSettings: false,
    category: 'choice',
  },
  {
    type: 'ending',
    labelKey: 'surveyTemplate.questionTypes.ending',
    icon: 'Celebration',
    hasOptions: false,
    hasSettings: false,
    category: 'content',
  },
];

// ==================== API Service ====================
//
// IMPORTANT: The `api` instance (ApiService) already unwraps `response.data`
// in its request() method. So `api.get()` returns `{ success, data, message }`
// directly — NOT the raw AxiosResponse. Use `response.data` to access the
// payload, NOT `response.data.data`.
//

const surveyTemplateService = {
  /**
   * List all templates
   */
  async getTemplates(
    projectApiPath: string,
    params?: {
      page?: number;
      limit?: number;
      isPublished?: boolean;
      search?: string;
    }
  ): Promise<{
    templates: SurveyTemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get(`${projectApiPath}/survey-templates`, {
      params,
    });
    return response.data;
  },

  /**
   * Get single template
   */
  async getTemplateById(
    projectApiPath: string,
    id: string
  ): Promise<SurveyTemplate> {
    const response = await api.get(`${projectApiPath}/survey-templates/${id}`);
    return response.data.template;
  },

  /**
   * Create template
   */
  async createTemplate(
    projectApiPath: string,
    input: CreateTemplateInput
  ): Promise<SurveyTemplate> {
    const response = await api.post(
      `${projectApiPath}/survey-templates`,
      input
    );
    return response.data.template;
  },

  /**
   * Update template
   */
  async updateTemplate(
    projectApiPath: string,
    id: string,
    input: UpdateTemplateInput
  ): Promise<SurveyTemplate> {
    const response = await api.put(
      `${projectApiPath}/survey-templates/${id}`,
      input
    );
    return response.data.template;
  },

  /**
   * Delete template
   */
  async deleteTemplate(projectApiPath: string, id: string): Promise<void> {
    await api.delete(`${projectApiPath}/survey-templates/${id}`);
  },

  /**
   * Duplicate template
   */
  async duplicateTemplate(
    projectApiPath: string,
    id: string
  ): Promise<SurveyTemplate> {
    const response = await api.post(
      `${projectApiPath}/survey-templates/${id}/duplicate`
    );
    return response.data.template;
  },

  /**
   * Toggle published status
   */
  async togglePublish(
    projectApiPath: string,
    id: string
  ): Promise<SurveyTemplate> {
    const response = await api.patch(
      `${projectApiPath}/survey-templates/${id}/toggle-publish`
    );
    return response.data.template;
  },

  /**
   * Get responses for a survey
   */
  async getResponses(
    projectApiPath: string,
    surveyId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    responses: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get(
      `${projectApiPath}/survey-templates/${surveyId}/responses`,
      { params }
    );
    return response.data;
  },

  /**
   * Get response statistics
   */
  async getResponseStats(
    projectApiPath: string,
    surveyId: string
  ): Promise<{
    totalResponses: number;
    questionStats: Record<string, any>;
  }> {
    const response = await api.get(
      `${projectApiPath}/survey-templates/${surveyId}/stats`
    );
    return response.data;
  },
};

export default surveyTemplateService;
