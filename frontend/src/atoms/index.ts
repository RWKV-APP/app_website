import { atom } from 'jotai';
import { type Locale, defaultLocale, detectLocale } from '@/i18n/locales';
import { getTranslations, type Translations } from '@/i18n/translations';

// Locale atom - initialized with default, will be updated on client
export const localeAtom = atom<Locale>(defaultLocale);

// Derived atom for translations
export const translationsAtom = atom<Translations>((get) => {
  const locale = get(localeAtom);
  return getTranslations(locale);
});

// Helper to detect and set locale
export { detectLocale };
