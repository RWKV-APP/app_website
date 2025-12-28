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

// Theme types
export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'theme-preference';

// Helper function to get system theme
function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Helper function to apply theme to document
function applyThemeToDocument(newTheme: Theme, pref?: ThemePreference) {
  if (typeof document === 'undefined') return;
  const currentPref = pref ?? (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null);
  if (currentPref === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', newTheme);
  }
  document.documentElement.style.colorScheme = newTheme;
}

// Get initial theme preference
export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
  return saved && ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
}

// Get initial theme based on preference
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const pref = getInitialThemePreference();
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref;
}

// Theme preference atom
const _themePreferenceAtomBase = atom<ThemePreference>('system');

export const themePreferenceAtom = atom(
  (get) => get(_themePreferenceAtomBase),
  (get, set, update: ThemePreference) => {
    set(_themePreferenceAtomBase, update);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, update);
      if (update === 'system') {
        const systemTheme = getSystemTheme();
        applyThemeToDocument(systemTheme, update);
      } else {
        applyThemeToDocument(update, update);
      }
    }
  },
);

// Theme atom - derived from preference
export const themeAtom = atom(
  (get) => {
    const preference = get(themePreferenceAtom);
    if (preference === 'system') {
      return getSystemTheme();
    }
    return preference;
  },
  (get, set, update: Theme) => {
    set(themePreferenceAtom, update);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, update);
      applyThemeToDocument(update, update);
    }
  },
);

// Initialize theme on client side
if (typeof window !== 'undefined') {
  const initialPref = getInitialThemePreference();
  const initialTheme = getInitialTheme();
  _themePreferenceAtomBase.init = initialPref;
  applyThemeToDocument(initialTheme, initialPref);

  // Listen to system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    const currentPref = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
    if (!currentPref || currentPref === 'system') {
      const newSystemTheme = getSystemTheme();
      applyThemeToDocument(newSystemTheme, 'system');
    }
  };
  mediaQuery.addEventListener('change', handleSystemChange);
}

// Device platform types
export type DevicePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';

// Device detection function
function detectDevicePlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent.toLowerCase();
  const platformStr = navigator.platform.toLowerCase();

  // 检测 iOS (包括 iPhone, iPad, iPod)
  if (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platformStr === 'macintel' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }

  // 检测 Android
  if (/android/.test(userAgent)) {
    return 'android';
  }

  // 检测 macOS
  if (/macintosh|mac os x/.test(userAgent) || platformStr.includes('mac')) {
    return 'macos';
  }

  // 检测 Windows
  if (/windows/.test(userAgent) || platformStr.includes('win')) {
    return 'windows';
  }

  // 检测 Linux
  if (/linux/.test(userAgent) || platformStr.includes('linux')) {
    return 'linux';
  }

  return 'unknown';
}

// Device platform atom
export const devicePlatformAtom = atom<DevicePlatform>(() => {
  if (typeof window === 'undefined') return 'unknown';
  return detectDevicePlatform();
});

// Derived atoms for device type
export const isMobileAtom = atom<boolean>((get) => {
  const platform = get(devicePlatformAtom);
  return platform === 'ios' || platform === 'android';
});

export const isDesktopAtom = atom<boolean>((get) => {
  const platform = get(devicePlatformAtom);
  return platform === 'macos' || platform === 'windows' || platform === 'linux';
});

// Location types
export interface LocationInfo {
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  isMainlandChina: boolean;
}

// Location atom - initialized as null, will be updated on client
export const locationAtom = atom<LocationInfo | null>(null);
