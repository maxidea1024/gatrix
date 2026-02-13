/**
 * Common BCP 47 locale codes (language-COUNTRY combinations)
 * Format: language (ISO 639-1 lowercase) + '-' + country (ISO 3166-1 alpha-2 uppercase)
 */
export interface Locale {
    code: string; // BCP 47 locale code (e.g. 'ko-KR')
    name: string; // English name
}

/**
 * Commonly used BCP 47 locale codes
 */
export const COMMON_LOCALES: Locale[] = [
    { code: 'af-ZA', name: 'Afrikaans (South Africa)' },
    { code: 'am-ET', name: 'Amharic (Ethiopia)' },
    { code: 'ar-AE', name: 'Arabic (United Arab Emirates)' },
    { code: 'ar-EG', name: 'Arabic (Egypt)' },
    { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
    { code: 'az-AZ', name: 'Azerbaijani (Azerbaijan)' },
    { code: 'be-BY', name: 'Belarusian (Belarus)' },
    { code: 'bg-BG', name: 'Bulgarian (Bulgaria)' },
    { code: 'bn-BD', name: 'Bengali (Bangladesh)' },
    { code: 'bn-IN', name: 'Bengali (India)' },
    { code: 'bs-BA', name: 'Bosnian (Bosnia and Herzegovina)' },
    { code: 'ca-ES', name: 'Catalan (Spain)' },
    { code: 'cs-CZ', name: 'Czech (Czech Republic)' },
    { code: 'cy-GB', name: 'Welsh (United Kingdom)' },
    { code: 'da-DK', name: 'Danish (Denmark)' },
    { code: 'de-AT', name: 'German (Austria)' },
    { code: 'de-CH', name: 'German (Switzerland)' },
    { code: 'de-DE', name: 'German (Germany)' },
    { code: 'el-GR', name: 'Greek (Greece)' },
    { code: 'en-AU', name: 'English (Australia)' },
    { code: 'en-CA', name: 'English (Canada)' },
    { code: 'en-GB', name: 'English (United Kingdom)' },
    { code: 'en-IE', name: 'English (Ireland)' },
    { code: 'en-IN', name: 'English (India)' },
    { code: 'en-NZ', name: 'English (New Zealand)' },
    { code: 'en-PH', name: 'English (Philippines)' },
    { code: 'en-SG', name: 'English (Singapore)' },
    { code: 'en-US', name: 'English (United States)' },
    { code: 'en-ZA', name: 'English (South Africa)' },
    { code: 'es-AR', name: 'Spanish (Argentina)' },
    { code: 'es-CL', name: 'Spanish (Chile)' },
    { code: 'es-CO', name: 'Spanish (Colombia)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'es-MX', name: 'Spanish (Mexico)' },
    { code: 'es-PE', name: 'Spanish (Peru)' },
    { code: 'et-EE', name: 'Estonian (Estonia)' },
    { code: 'eu-ES', name: 'Basque (Spain)' },
    { code: 'fa-IR', name: 'Persian (Iran)' },
    { code: 'fi-FI', name: 'Finnish (Finland)' },
    { code: 'fil-PH', name: 'Filipino (Philippines)' },
    { code: 'fr-BE', name: 'French (Belgium)' },
    { code: 'fr-CA', name: 'French (Canada)' },
    { code: 'fr-CH', name: 'French (Switzerland)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'ga-IE', name: 'Irish (Ireland)' },
    { code: 'gl-ES', name: 'Galician (Spain)' },
    { code: 'gu-IN', name: 'Gujarati (India)' },
    { code: 'he-IL', name: 'Hebrew (Israel)' },
    { code: 'hi-IN', name: 'Hindi (India)' },
    { code: 'hr-HR', name: 'Croatian (Croatia)' },
    { code: 'hu-HU', name: 'Hungarian (Hungary)' },
    { code: 'hy-AM', name: 'Armenian (Armenia)' },
    { code: 'id-ID', name: 'Indonesian (Indonesia)' },
    { code: 'is-IS', name: 'Icelandic (Iceland)' },
    { code: 'it-CH', name: 'Italian (Switzerland)' },
    { code: 'it-IT', name: 'Italian (Italy)' },
    { code: 'ja-JP', name: 'Japanese (Japan)' },
    { code: 'jv-ID', name: 'Javanese (Indonesia)' },
    { code: 'ka-GE', name: 'Georgian (Georgia)' },
    { code: 'kk-KZ', name: 'Kazakh (Kazakhstan)' },
    { code: 'km-KH', name: 'Khmer (Cambodia)' },
    { code: 'kn-IN', name: 'Kannada (India)' },
    { code: 'ko-KR', name: 'Korean (South Korea)' },
    { code: 'ku-TR', name: 'Kurdish (Turkey)' },
    { code: 'ky-KG', name: 'Kyrgyz (Kyrgyzstan)' },
    { code: 'lo-LA', name: 'Lao (Laos)' },
    { code: 'lt-LT', name: 'Lithuanian (Lithuania)' },
    { code: 'lv-LV', name: 'Latvian (Latvia)' },
    { code: 'mk-MK', name: 'Macedonian (North Macedonia)' },
    { code: 'ml-IN', name: 'Malayalam (India)' },
    { code: 'mn-MN', name: 'Mongolian (Mongolia)' },
    { code: 'mr-IN', name: 'Marathi (India)' },
    { code: 'ms-MY', name: 'Malay (Malaysia)' },
    { code: 'ms-SG', name: 'Malay (Singapore)' },
    { code: 'mt-MT', name: 'Maltese (Malta)' },
    { code: 'my-MM', name: 'Burmese (Myanmar)' },
    { code: 'nb-NO', name: 'Norwegian Bokmål (Norway)' },
    { code: 'ne-NP', name: 'Nepali (Nepal)' },
    { code: 'nl-BE', name: 'Dutch (Belgium)' },
    { code: 'nl-NL', name: 'Dutch (Netherlands)' },
    { code: 'nn-NO', name: 'Norwegian Nynorsk (Norway)' },
    { code: 'pa-IN', name: 'Panjabi (India)' },
    { code: 'pl-PL', name: 'Polish (Poland)' },
    { code: 'ps-AF', name: 'Pashto (Afghanistan)' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'pt-PT', name: 'Portuguese (Portugal)' },
    { code: 'ro-RO', name: 'Romanian (Romania)' },
    { code: 'ru-RU', name: 'Russian (Russia)' },
    { code: 'ru-UA', name: 'Russian (Ukraine)' },
    { code: 'si-LK', name: 'Sinhala (Sri Lanka)' },
    { code: 'sk-SK', name: 'Slovak (Slovakia)' },
    { code: 'sl-SI', name: 'Slovenian (Slovenia)' },
    { code: 'so-SO', name: 'Somali (Somalia)' },
    { code: 'sq-AL', name: 'Albanian (Albania)' },
    { code: 'sr-RS', name: 'Serbian (Serbia)' },
    { code: 'sv-FI', name: 'Swedish (Finland)' },
    { code: 'sv-SE', name: 'Swedish (Sweden)' },
    { code: 'sw-KE', name: 'Swahili (Kenya)' },
    { code: 'sw-TZ', name: 'Swahili (Tanzania)' },
    { code: 'ta-IN', name: 'Tamil (India)' },
    { code: 'ta-LK', name: 'Tamil (Sri Lanka)' },
    { code: 'te-IN', name: 'Telugu (India)' },
    { code: 'tg-TJ', name: 'Tajik (Tajikistan)' },
    { code: 'th-TH', name: 'Thai (Thailand)' },
    { code: 'tk-TM', name: 'Turkmen (Turkmenistan)' },
    { code: 'tl-PH', name: 'Tagalog (Philippines)' },
    { code: 'tr-TR', name: 'Turkish (Turkey)' },
    { code: 'uk-UA', name: 'Ukrainian (Ukraine)' },
    { code: 'ur-PK', name: 'Urdu (Pakistan)' },
    { code: 'uz-UZ', name: 'Uzbek (Uzbekistan)' },
    { code: 'vi-VN', name: 'Vietnamese (Vietnam)' },
    { code: 'zh-CN', name: 'Chinese (China)' },
    { code: 'zh-HK', name: 'Chinese (Hong Kong)' },
    { code: 'zh-TW', name: 'Chinese (Taiwan)' },
    { code: 'zu-ZA', name: 'Zulu (South Africa)' },
];

/**
 * Set of valid locale codes for quick lookup
 */
export const LOCALE_CODE_SET = new Set(COMMON_LOCALES.map((l) => l.code));

/**
 * Lookup a locale by code
 */
export const getLocaleByCode = (code: string): Locale | undefined => {
    // Normalize: lowercase language, uppercase country
    const normalized = normalizeLocaleCode(code);
    return COMMON_LOCALES.find((l) => l.code === normalized);
};

/**
 * Normalize a locale code to BCP 47 format: language-COUNTRY
 */
export const normalizeLocaleCode = (code: string): string => {
    const parts = code.replace('_', '-').split('-');
    if (parts.length >= 2) {
        return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
    }
    return code.toLowerCase();
};

/**
 * Validate locale code format (language-COUNTRY)
 */
export const isValidLocaleFormat = (code: string): boolean => {
    return /^[a-z]{2,3}-[A-Z]{2}$/.test(code);
};

/**
 * Get display label for a locale code: "Korean (South Korea) (ko-KR)"
 */
export const getLocaleLabel = (code: string): string => {
    const locale = getLocaleByCode(code);
    if (!locale) return code;
    return `${locale.name} (${locale.code})`;
};
