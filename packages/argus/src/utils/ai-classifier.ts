/**
 * AI Feedback Classifier
 *
 * Uses the organization's configured LLM provider (from g_ai_settings)
 * to classify user feedback with sentiment, category, and spam detection.
 *
 * Falls back gracefully when AI is not configured.
 */

import { mysqlPool } from '../config/mysql';
import { createLogger } from './logger';

const logger = createLogger('ai-classifier');

export interface FeedbackClassification {
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'bug' | 'feature_request' | 'complaint' | 'praise' | 'question' | 'other';
  spam_score: number; // 0.0 – 1.0
}

interface AISettings {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string | null;
  apiBaseUrl: string | null;
}

// Cache AI settings to avoid per-request DB lookups
let cachedSettings: { data: AISettings | null; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

async function getAISettings(projectId: string): Promise<AISettings | null> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.fetchedAt < CACHE_TTL_MS) {
    return cachedSettings.data;
  }

  try {
    // Look up org from project, then get AI settings
    const [projectRows] = await mysqlPool.query(
      `SELECT p.gatrix_project_id FROM g_argus_projects p WHERE p.id = ? LIMIT 1`,
      [projectId]
    );
    const project = (projectRows as any[])?.[0];
    if (!project?.gatrix_project_id) {
      cachedSettings = { data: null, fetchedAt: now };
      return null;
    }

    // Extract orgId from gatrix_project_id (format: "org:project" or just the org lookup)
    const [orgRows] = await mysqlPool.query(
      `SELECT s.* FROM g_ai_settings s
       JOIN g_projects gp ON gp.orgId = s.orgId
       WHERE gp.id = ?
       LIMIT 1`,
      [project.gatrix_project_id]
    );
    const settings = (orgRows as any[])?.[0];
    if (!settings || !settings.enabled || !settings.apiKey) {
      cachedSettings = { data: null, fetchedAt: now };
      return null;
    }

    const result: AISettings = {
      enabled: Boolean(settings.enabled),
      provider: settings.provider || 'openai',
      model: settings.model || 'gpt-4o-mini',
      apiKey: settings.apiKey,
      apiBaseUrl: settings.apiBaseUrl || null,
    };
    cachedSettings = { data: result, fetchedAt: now };
    return result;
  } catch (error: any) {
    // Tables may not exist yet — graceful fallback
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      cachedSettings = { data: null, fetchedAt: now };
      return null;
    }
    logger.warn('Failed to fetch AI settings', { error: error.message });
    cachedSettings = { data: null, fetchedAt: now };
    return null;
  }
}

const CLASSIFICATION_PROMPT = `You are a feedback classifier. Analyze the user feedback message and return a JSON object with exactly these fields:

- "sentiment": one of "positive", "negative", "neutral"
- "category": one of "bug", "feature_request", "complaint", "praise", "question", "other"
- "spam_score": a number from 0.0 to 1.0 (1.0 = definitely spam)

Rules:
- Bug reports describe something broken, crashing, or not working as expected
- Feature requests ask for new features or improvements
- Complaints express frustration without describing a specific bug
- Praise is positive feedback about the product
- Questions ask for help or clarification
- Spam includes ads, gibberish, test messages, or irrelevant content

Return ONLY the JSON object, no markdown, no explanation.`;

/**
 * Classify a feedback message using the organization's LLM.
 * Returns null if AI is not configured or the call fails.
 */
export async function classifyFeedback(
  projectId: string,
  message: string
): Promise<FeedbackClassification | null> {
  if (!message?.trim()) return null;

  const settings = await getAISettings(projectId);
  if (!settings) return null;

  try {
    const result = await callLLM(settings, message);
    return result;
  } catch (error) {
    logger.warn('Feedback classification failed', {
      error: (error as Error).message,
    });
    return null;
  }
}

async function callLLM(
  settings: AISettings,
  message: string
): Promise<FeedbackClassification | null> {
  const { provider, model, apiKey, apiBaseUrl } = settings;

  let url: string;
  let headers: Record<string, string>;
  let body: any;

  // Build request based on provider
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'qwen': {
      // All OpenAI-compatible providers
      const baseUrl = apiBaseUrl ||
        (provider === 'deepseek' ? 'https://api.deepseek.com' :
         provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode' :
         'https://api.openai.com');
      url = `${baseUrl}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      body = {
        model,
        messages: [
          { role: 'system', content: CLASSIFICATION_PROMPT },
          { role: 'user', content: `Feedback message:\n"${message}"` },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      };
      break;
    }
    case 'claude': {
      url = apiBaseUrl || 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
      };
      body = {
        model,
        max_tokens: 200,
        system: CLASSIFICATION_PROMPT,
        messages: [
          { role: 'user', content: `Feedback message:\n"${message}"` },
        ],
      };
      break;
    }
    case 'gemini': {
      url = `${apiBaseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = {
        contents: [
          { role: 'user', parts: [{ text: `${CLASSIFICATION_PROMPT}\n\nFeedback message:\n"${message}"` }] },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      };
      break;
    }
    default:
      logger.warn('Unsupported AI provider for classification', { provider });
      return null;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  if (!response.ok) {
    logger.warn('LLM API error', { status: response.status, provider });
    return null;
  }

  const data: any = await response.json();

  // Extract text content based on provider
  let text: string;
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'qwen':
      text = data.choices?.[0]?.message?.content || '';
      break;
    case 'claude':
      text = data.content?.[0]?.text || '';
      break;
    case 'gemini':
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      break;
    default:
      return null;
  }

  return parseClassificationResponse(text);
}

function parseClassificationResponse(text: string): FeedbackClassification | null {
  try {
    // Remove markdown code fence if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const validSentiments = ['positive', 'negative', 'neutral'];
    const validCategories = ['bug', 'feature_request', 'complaint', 'praise', 'question', 'other'];

    return {
      sentiment: validSentiments.includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      category: validCategories.includes(parsed.category) ? parsed.category : 'other',
      spam_score: typeof parsed.spam_score === 'number'
        ? Math.max(0, Math.min(1, parsed.spam_score))
        : 0,
    };
  } catch (error) {
    logger.warn('Failed to parse classification response', { text: text.slice(0, 200) });
    return null;
  }
}
