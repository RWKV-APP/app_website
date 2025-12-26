export type Locale = 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'en' | 'ru';

export const locales: Locale[] = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en', 'ru'];

export const localeNames: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  en: 'English',
  ru: 'Русский',
};

export const defaultLocale: Locale = 'en';

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return defaultLocale;
  }

  const browserLang = navigator.language;

  // Exact match
  if (locales.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  // Match by prefix
  const langPrefix = browserLang.split('-')[0];

  // Handle Chinese variants
  if (langPrefix === 'zh') {
    if (browserLang.includes('TW') || browserLang.includes('HK') || browserLang.includes('Hant')) {
      return 'zh-TW';
    }
    return 'zh-CN';
  }

  // Match other languages
  const matchedLocale = locales.find((locale) => locale.startsWith(langPrefix));
  if (matchedLocale) {
    return matchedLocale;
  }

  return defaultLocale;
}
