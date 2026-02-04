import React, { createContext, useContext, ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Language } from '@/types';
import { UserService } from '@/services/users';

// Import translation files (INI format)
import enTranslations from '@/locales/en.ini';
import koTranslations from '@/locales/ko.ini';
import zhTranslations from '@/locales/zh.ini';

// Language configuration
const resources = {
  en: {
    translation: enTranslations,
  },
  ko: {
    translation: koTranslations,
  },
  zh: {
    translation: zhTranslations,
  },
};

const supportedLanguages: Language[] = ['en', 'ko', 'zh'];
const defaultLanguage: Language = 'en';

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: false, // Disable fallback to show missing keys
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    debug: false, // Set to true for i18n debugging

    // IMPORTANT: Disable key separator to treat keys as flat strings
    // This allows "integrations.providers.slack.displayName" to be found directly
    keySeparator: false,
    nsSeparator: false,

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false,
    },

    // Show the key itself when translation is missing
    saveMissing: false,
    returnEmptyString: false,
    returnNull: false,
  });

interface I18nContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, options?: any) => string;
  isRTL: boolean;
  supportedLanguages: Language[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { t, i18n: i18nInstance } = useTranslation();

  // Migrate legacy localStorage key if present (i8nextLng -> i18nextLng)
  try {
    const legacy = localStorage.getItem('i8nextLng');
    if (legacy && !localStorage.getItem('i18nextLng')) {
      localStorage.setItem('i18nextLng', legacy);
      i18nInstance.changeLanguage(legacy as Language);
    }
  } catch {}

  const changeLanguage = async (lang: Language) => {
    // 프론트엔드 언어 변경
    i18nInstance.changeLanguage(lang);

    // 백엔드에 사용자 언어 설정 업데이트 (로그인된 사용자만)
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await UserService.updateLanguage(lang);
        console.log(`✅ User language preference updated to: ${lang}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update user language preference:', error);
      // 백엔드 업데이트 실패해도 프론트엔드 언어 변경은 유지
    }
  };

  const isRTL = false; // None of our supported languages are RTL

  const value: I18nContextType = {
    language: i18nInstance.language as Language,
    changeLanguage,
    t,
    isRTL,
    supportedLanguages,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Helper hook for translations with better TypeScript support
export const useTranslations = () => {
  const { t } = useI18n();

  return {
    t,
    // Common translations
    common: {
      loading: t('common.loading'),
      loadFailed: t('common.loadFailed'),
      error: t('common.error'),
      success: t('common.success'),
      warning: t('common.warning'),
      info: t('common.info'),
      save: t('common.save'),
      cancel: t('common.cancel'),
      delete: t('common.delete'),
      edit: t('common.edit'),
      add: t('common.add'),
      search: t('common.search'),
      filter: t('common.filter'),
      refresh: t('common.refresh'),
      back: t('common.back'),
      next: t('common.next'),
      previous: t('common.previous'),
      submit: t('common.submit'),
      reset: t('common.reset'),
      confirm: t('common.confirm'),
      yes: t('common.yes'),
      no: t('common.no'),
      ok: t('common.ok'),
      close: t('common.close'),
    },
    // Navigation translations
    nav: {
      dashboard: t('navigation.dashboard'),
      users: t('navigation.users'),
      profile: t('navigation.profile'),
      settings: t('navigation.settings'),
      administration: t('navigation.administration'),
      userManagement: t('navigation.userManagement'),
      auditLogs: t('navigation.auditLogs'),
      systemStats: t('navigation.systemStats'),
      logout: t('navigation.logout'),
    },
    // Auth translations
    auth: {
      login: t('auth.login'),
      register: t('auth.register'),
      logout: t('auth.logout'),
      email: t('auth.email'),
      password: t('auth.password'),
      confirmPassword: t('auth.confirmPassword'),
      name: t('auth.name'),
      forgotPassword: t('auth.forgotPassword'),
      rememberMe: t('auth.rememberMe'),
      loginWithGoogle: t('auth.loginWithGoogle'),
      loginWithGitHub: t('auth.loginWithGitHub'),
      alreadyHaveAccount: t('auth.alreadyHaveAccount'),
      dontHaveAccount: t('auth.dontHaveAccount'),
      signUp: t('auth.signUp'),
      signIn: t('auth.signIn'),
      welcomeBack: t('auth.welcomeBack'),
      createAccount: t('auth.createAccount'),
      loginSuccess: t('auth.loginSuccess'),
      loginFailed: t('auth.loginFailed'),
      registerSuccess: t('auth.registerSuccess'),
      registerFailed: t('auth.registerFailed'),
      logoutSuccess: t('auth.logoutSuccess'),
      invalidCredentials: t('auth.invalidCredentials'),
      accountPending: t('auth.accountPending'),
      accountSuspended: t('auth.accountSuspended'),
    },
    // Status translations
    status: {
      pending: t('status.pending'),
      active: t('status.active'),
      suspended: t('status.suspended'),
      deleted: t('status.deleted'),
    },
    // Role translations
    roles: {
      admin: t('roles.admin'),
      user: t('roles.user'),
    },
    // Error translations
    errors: {
      generic: t('errors.generic'),
      networkError: t('errors.networkError'),
      unauthorized: t('errors.unauthorized'),
      forbidden: t('errors.forbidden'),
      notFound: t('errors.notFound'),
      serverError: t('errors.serverError'),
      validationError: t('errors.validationError'),
      sessionExpired: t('errors.sessionExpired'),
      tryAgain: t('errors.tryAgain'),
      contactSupport: t('errors.contactSupport'),
    },
  };
};

// Language display names
export const getLanguageDisplayName = (lang: Language): string => {
  const displayNames: Record<Language, string> = {
    en: 'English',
    ko: '한국어',
    zh: '中文',
  };
  return displayNames[lang] || lang;
};

// Get current language from i18n instance
export const getCurrentLanguage = (): Language => {
  return (i18n.language as Language) || defaultLanguage;
};

// Check if language is supported
export const isSupportedLanguage = (lang: string): lang is Language => {
  return supportedLanguages.includes(lang as Language);
};

export default i18n;
