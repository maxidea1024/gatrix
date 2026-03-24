import axios from 'axios';
import { createLogger } from '../config/logger';

const logger = createLogger('TranslationService');
import redisClient from '../config/redis';
import crypto from 'crypto';
import { TRANSLATION, DEFAULT_CONFIG } from '../constants/cache-keys';

export interface TranslationRequest {
  text: string;
  targetLanguage: 'ko' | 'en' | 'zh';
  sourceLanguage?: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class TranslationService {
  private static readonly GOOGLE_TRANSLATE_API_URL =
    'https://translate.googleapis.com/translate_a/single';

  /**
   * Translate text using free Google Translate API
   */
  static async translateText(
    request: TranslationRequest
  ): Promise<TranslationResponse> {
    try {
      const { text, targetLanguage, sourceLanguage = 'auto' } = request;

      if (!text || text.trim().length === 0) {
        throw new Error('Translation text is required');
      }

      // Cache lookup (hash based on input text)
      const baseText = text.trim();
      const hash = crypto.createHash('sha256').update(baseText).digest('hex');
      const cacheKey = TRANSLATION.BY_TEXT_LANG(hash, targetLanguage);
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          try {
            const cachedObj = JSON.parse(cached);
            return cachedObj as TranslationResponse;
          } catch (_) {
            return {
              translatedText: cached,
              sourceLanguage: sourceLanguage,
              targetLanguage,
            };
          }
        }
      } catch (e) {
        logger.debug('Translation cache get failed', e);
      }

      // Language code mapping (to Google Translate API format)
      const languageMap: Record<string, string> = {
        ko: 'ko',
        en: 'en',
        zh: 'zh-cn',
      };

      const targetLang = languageMap[targetLanguage];
      if (!targetLang) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      // Detect source language first
      let detectedLang = sourceLanguage;
      if (sourceLanguage === 'auto') {
        detectedLang = await this.detectLanguage(text);
        logger.debug(
          `Detected source language: ${detectedLang} for target: ${targetLanguage}`
        );
      }

      // Return original text only if source and target languages match exactly
      if (detectedLang === targetLang && detectedLang !== 'auto') {
        const result: TranslationResponse = {
          translatedText: text.trim(),
          sourceLanguage: detectedLang,
          targetLanguage,
        };
        try {
          const TRANSLATION_TTL_SECONDS = Math.floor(
            DEFAULT_CONFIG.TRANSLATION_TTL / 1000
          );
          await redisClient.set(
            cacheKey,
            JSON.stringify(result),
            TRANSLATION_TTL_SECONDS
          );
        } catch (e) {
          logger.debug('Translation cache set failed', e);
        }
        return result;
      }

      // Call Google Translate API (free version)
      const params = new URLSearchParams({
        client: 'gtx',
        sl: detectedLang,
        tl: targetLang,
        dt: 't',
        q: text,
      });

      logger.debug(
        `Translating from ${detectedLang} to ${targetLang}: "${text.substring(0, 50)}..."`
      );

      const response = await axios.get(
        `${this.GOOGLE_TRANSLATE_API_URL}?${params}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 10000,
        }
      );

      // Parse response
      if (
        !response.data ||
        !Array.isArray(response.data) ||
        !response.data[0]
      ) {
        throw new Error('Invalid translation response format');
      }

      const translatedText = response.data[0]
        .filter((item: any) => Array.isArray(item) && item[0])
        .map((item: any) => item[0])
        .join('');

      const finalDetectedLanguage = response.data[2] || detectedLang;

      logger.debug(
        `Translation result: "${translatedText.substring(0, 50)}..."`
      );

      const result: TranslationResponse = {
        translatedText: translatedText.trim(),
        sourceLanguage: finalDetectedLanguage,
        targetLanguage,
      };
      try {
        const TRANSLATION_TTL_SECONDS = Math.floor(
          DEFAULT_CONFIG.TRANSLATION_TTL / 1000
        );
        await redisClient.set(
          cacheKey,
          JSON.stringify(result),
          TRANSLATION_TTL_SECONDS
        );
      } catch (e) {
        logger.debug('Translation cache set failed', e);
      }
      return result;
    } catch (error: any) {
      logger.error('Translation error:', {
        error: error.message,
        request,
        stack: error.stack,
      });

      // Return original text on translation failure
      return {
        translatedText: request.text,
        sourceLanguage: request.sourceLanguage || 'auto',
        targetLanguage: request.targetLanguage,
      };
    }
  }

  /**
   * Translate to multiple languages simultaneously
   */
  static async translateToMultipleLanguages(
    text: string,
    targetLanguages: ('ko' | 'en' | 'zh')[],
    sourceLanguage?: string
  ): Promise<Record<string, TranslationResponse>> {
    try {
      logger.debug(
        `Starting multiple translation for: "${text}" to languages: ${targetLanguages.join(', ')}`
      );

      const translations = await Promise.all(
        targetLanguages.map(async (lang) => {
          const result = await this.translateText({
            text,
            targetLanguage: lang,
            sourceLanguage,
          });
          logger.debug(`Translation to ${lang}: "${result.translatedText}"`);
          return { lang, result };
        })
      );

      const translationMap: Record<string, TranslationResponse> = {};
      translations.forEach(({ lang, result }) => {
        translationMap[lang] = result;
      });

      logger.debug('Final translation map:', translationMap);
      return translationMap;
    } catch (error) {
      logger.error('Multiple translation error:', error);
      throw error;
    }
  }

  /**
   * Detect language
   */
  static async detectLanguage(text: string): Promise<string> {
    try {
      const base = text.trim().substring(0, 100);
      const hash = crypto.createHash('sha256').update(base).digest('hex');
      const cacheKey = TRANSLATION.DETECT(hash);

      // Cache lookup
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (e) {
        logger.debug('Language detect cache get failed', e);
      }

      const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'en',
        dt: 't',
        q: base, // Use first 100 characters only
      });

      const response = await axios.get(
        `${this.GOOGLE_TRANSLATE_API_URL}?${params}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 5000,
        }
      );

      const detected = response.data[2] || 'auto';

      // Cache Save
      try {
        const TRANSLATION_TTL_SECONDS = Math.floor(
          DEFAULT_CONFIG.TRANSLATION_TTL / 1000
        );
        await redisClient.set(cacheKey, detected, TRANSLATION_TTL_SECONDS);
      } catch (e) {
        logger.debug('Language detect cache set failed', e);
      }

      return detected;
    } catch (error) {
      logger.error('Language detection error:', error);
      return 'auto';
    }
  }
}
