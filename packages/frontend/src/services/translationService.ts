import api from './api';

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

export interface MultipleTranslationRequest {
  text: string;
  targetLanguages: ('ko' | 'en' | 'zh')[];
  sourceLanguage?: string;
}

export interface MultipleTranslationResponse {
  [key: string]: TranslationResponse;
}

export interface LanguageDetectionRequest {
  text: string;
}

export interface LanguageDetectionResponse {
  detectedLanguage: string;
}

class TranslationService {
  /**
   * 단일 언어로 번역
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const response = await api.post<TranslationResponse>('/admin/translation/translate', request);
      // API service already returns response.data, so response is ApiResponse<TranslationResponse>
      // We need to access response.data to get the actual TranslationResponse
      return (response as any).data as TranslationResponse;
    } catch (error: any) {
      console.error('Translation error:', error);
      throw new Error(error.response?.data?.message || 'Translation failed');
    }
  }

  /**
   * 여러 언어로 동시 번역
   */
  async translateToMultipleLanguages(request: MultipleTranslationRequest): Promise<MultipleTranslationResponse> {
    try {
      const response = await api.post<MultipleTranslationResponse>('/admin/translation/translate/multiple', request);
      // API service already returns response.data, so response is ApiResponse<MultipleTranslationResponse>
      // We need to access response.data to get the actual MultipleTranslationResponse
      console.log('Translation API response:', response);
      return (response as any).data as MultipleTranslationResponse;
    } catch (error: any) {
      console.error('Multiple translation error:', error);
      throw new Error(error.response?.data?.message || 'Multiple translation failed');
    }
  }

  /**
   * 언어 감지
   */
  async detectLanguage(request: LanguageDetectionRequest): Promise<LanguageDetectionResponse> {
    try {
      const response = await api.post<LanguageDetectionResponse>('/admin/translation/detect-language', request);
      // API service already returns response.data, so response is ApiResponse<LanguageDetectionResponse>
      // We need to access response.data to get the actual LanguageDetectionResponse
      return (response as any).data as LanguageDetectionResponse;
    } catch (error: any) {
      console.error('Language detection error:', error);
      throw new Error(error.response?.data?.message || 'Language detection failed');
    }
  }

  /**
   * 게임월드 점검 메시지 자동 번역
   */
  async translateMaintenanceMessage(
    baseMessage: string,
    targetLanguages: ('ko' | 'en' | 'zh')[] = ['ko', 'en', 'zh']
  ): Promise<MultipleTranslationResponse> {
    try {
      if (!baseMessage || baseMessage.trim().length === 0) {
        throw new Error('Base message is required for translation');
      }

      const response = await this.translateToMultipleLanguages({
        text: baseMessage.trim(),
        targetLanguages,
        sourceLanguage: 'auto'
      });



      // 응답을 그대로 반환 (객체 형태 유지)

      return response;
    } catch (error: any) {
      console.error('Maintenance message translation error:', error);
      
      // 번역 실패 시 원본 메시지를 모든 언어에 반환
      const fallbackTranslations: MultipleTranslationResponse = {};
      targetLanguages.forEach(lang => {
        fallbackTranslations[lang] = {
          translatedText: baseMessage,
          sourceLanguage: 'auto',
          targetLanguage: lang
        };
      });

      return fallbackTranslations;
    }
  }

  /**
   * 언어 코드를 한국어 이름으로 변환
   */
  getLanguageName(languageCode: string): string {
    const languageNames: Record<string, string> = {
      'ko': '한국어',
      'en': '영어',
      'zh': '중국어',
      'zh-cn': '중국어(간체)',
      'ja': '일본어',
      'auto': '자동 감지'
    };

    return languageNames[languageCode] || languageCode;
  }

  /**
   * 번역 가능한 언어 목록
   */
  getSupportedLanguages(): Array<{ code: 'ko' | 'en' | 'zh'; name: string }> {
    return [
      { code: 'ko', name: '한국어' },
      { code: 'en', name: '영어' },
      { code: 'zh', name: '중국어' }
    ];
  }
}

export default new TranslationService();
