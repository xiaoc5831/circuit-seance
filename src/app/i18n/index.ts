/**
 * i18n hook and context for Circuit Séance
 */
import { createContext, useContext } from 'react';
import type { AppSettings } from '@/shared/types';
import { en } from './en';
import { zhCN } from './zh-CN';

const locales = {
  en,
  'zh-CN': zhCN,
} as const;

export type LocaleKey = keyof typeof en;

/**
 * Retrieve the locale map for the current language
 */
export function getLocale(language: AppSettings['language']): Record<LocaleKey, string> {
  return locales[language];
}

/**
 * Translate a key to the current language
 */
export function t(key: LocaleKey, locale: Record<LocaleKey, string>): string {
  return locale[key] ?? key;
}

// Context for sharing language and translation function
export const LanguageContext = createContext<{
  language: AppSettings['language'];
  setLanguage: (lang: AppSettings['language']) => void;
  locale: Record<LocaleKey, string>;
  t: (key: LocaleKey) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  locale: locales.en,
  t: (key) => key,
});

/**
 * Hook to use translation strings in components
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
