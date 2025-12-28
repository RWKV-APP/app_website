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

/**
 * Detect locale based on geographic location
 * @param locationInfo - Location information from IP geolocation
 * @returns Locale based on country/region
 */
export function detectLocaleFromLocation(locationInfo: {
  countryCode: string;
  isMainlandChina: boolean;
}): Locale | null {
  const { countryCode, isMainlandChina } = locationInfo;

  // Mainland China → Simplified Chinese
  if (isMainlandChina && countryCode === 'CN') {
    return 'zh-CN';
  }

  // Hong Kong, Macau, Taiwan → Traditional Chinese
  if (countryCode === 'HK' || countryCode === 'MO' || countryCode === 'TW') {
    return 'zh-TW';
  }

  // Japan → Japanese
  if (countryCode === 'JP') {
    return 'ja';
  }

  // South Korea → Korean
  if (countryCode === 'KR') {
    return 'ko';
  }

  // Russia → Russian
  if (countryCode === 'RU') {
    return 'ru';
  }

  // No match, return null to use browser default
  return null;
}
