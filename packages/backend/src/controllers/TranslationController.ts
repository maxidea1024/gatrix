import { Request, Response } from "express";
import Joi from "joi";
import { TranslationService } from "../services/TranslationService";
import { asyncHandler } from "../middleware/errorHandler";
import { GatrixError } from "../middleware/errorHandler";
import { sleep } from "../utils/asyncUtils";

// Ensure a minimum response time for UI update timing
const MIN_RESPONSE_MS = 2_000;

// 단일 번역 요청 스키마
const translateSchema = Joi.object({
  text: Joi.string().required().max(5000).messages({
    "string.empty": "Translation text is required",
    "string.max": "Text is too long (maximum 5000 characters)",
  }),
  targetLanguage: Joi.string().valid("ko", "en", "zh").required().messages({
    "any.only": "Target language must be one of: ko, en, zh",
  }),
  sourceLanguage: Joi.string().optional().default("auto"),
});

// 다중 번역 요청 스키마
const translateMultipleSchema = Joi.object({
  text: Joi.string().required().max(5000).messages({
    "string.empty": "Translation text is required",
    "string.max": "Text is too long (maximum 5000 characters)",
  }),
  targetLanguages: Joi.array()
    .items(Joi.string().valid("ko", "en", "zh"))
    .min(1)
    .max(3)
    .required()
    .messages({
      "array.min": "At least one target language is required",
      "array.max": "Maximum 3 target languages allowed",
    }),
  sourceLanguage: Joi.string().optional().default("auto"),
});

// 언어 감지 요청 스키마
const detectLanguageSchema = Joi.object({
  text: Joi.string().required().max(1000).messages({
    "string.empty": "Text is required for language detection",
    "string.max":
      "Text is too long for language detection (maximum 1000 characters)",
  }),
});

export class TranslationController {
  /**
   * 단일 언어 번역
   */
  static translateText = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();

    const { error, value } = translateSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const result = await TranslationService.translateText(value);

    const elapsed = Date.now() - startedAt;
    const remaining = MIN_RESPONSE_MS - elapsed;
    if (remaining > 0) await sleep(remaining);

    res.json({
      success: true,
      data: result,
      message: "Text translated successfully",
    });
  });

  /**
   * 다중 언어 번역
   */
  static translateToMultipleLanguages = asyncHandler(
    async (req: Request, res: Response) => {
      const startedAt = Date.now();

      const { error, value } = translateMultipleSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { text, targetLanguages, sourceLanguage } = value;

      const result = await TranslationService.translateToMultipleLanguages(
        text,
        targetLanguages,
        sourceLanguage,
      );

      const elapsed = Date.now() - startedAt;
      const remaining = MIN_RESPONSE_MS - elapsed;
      if (remaining > 0) await sleep(remaining);

      res.json({
        success: true,
        data: result,
        message: "Text translated to multiple languages successfully",
      });
    },
  );

  /**
   * 언어 감지
   */
  static detectLanguage = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();

    const { error, value } = detectLanguageSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const detectedLanguage = await TranslationService.detectLanguage(
      value.text,
    );

    const elapsed = Date.now() - startedAt;
    const remaining = MIN_RESPONSE_MS - elapsed;
    if (remaining > 0) await sleep(remaining);

    res.json({
      success: true,
      data: { detectedLanguage },
      message: "Language detected successfully",
    });
  });
}
