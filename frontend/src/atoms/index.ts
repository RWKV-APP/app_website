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
    if (typeof window === 'undefined') return;

    // Get current system theme
    const systemTheme = getSystemTheme();

    // If the user-selected theme matches system theme, save as 'system'
    // Otherwise, save as the selected theme
    const newPreference: ThemePreference = update === systemTheme ? 'system' : update;

    set(themePreferenceAtom, newPreference);
    applyThemeToDocument(update, newPreference);
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

// CPU architecture types
export type CpuArchitecture = 'x64' | 'arm64' | 'x86' | 'unknown';

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

// CPU architecture detection function
export async function detectCpuArchitecture(): Promise<CpuArchitecture> {
  if (typeof window === 'undefined') return 'unknown';

  // Try modern User-Agent Client Hints API (Chrome/Edge 90+)
  if ('userAgentData' in navigator && navigator.userAgentData) {
    try {
      const uaData = await (navigator.userAgentData as any).getHighEntropyValues(['architecture']);
      if (uaData.architecture) {
        const arch = uaData.architecture.toLowerCase();
        if (arch === 'x86' || arch === 'x64') {
          return 'x64'; // x86 is typically 32-bit, but we'll treat it as x64 for compatibility
        }
        if (arch === 'arm' || arch === 'arm64') {
          return 'arm64';
        }
        return arch as CpuArchitecture;
      }
    } catch (error) {
      // API might require permission or not be available
      console.debug('User-Agent Client Hints API not available:', error);
    }
  }

  // Fallback: Try to detect from userAgent string (less reliable)
  const userAgent = navigator.userAgent.toLowerCase();
  const platformStr = navigator.platform.toLowerCase();

  // Check for ARM indicators in userAgent
  if (/arm64|aarch64|armv8/.test(userAgent) || /arm64|aarch64/.test(platformStr)) {
    return 'arm64';
  }

  // Check for x64 indicators
  if (/x64|win64|wow64|amd64/.test(userAgent) || /x64|win64/.test(platformStr)) {
    return 'x64';
  }

  // For macOS, check if it's Apple Silicon (ARM64) or Intel (x64)
  if (platformStr.includes('mac')) {
    // Modern macOS on Apple Silicon
    if (/arm64|aarch64/.test(userAgent) || platformStr.includes('arm')) {
      return 'arm64';
    }
    // Intel Mac (older or Intel-based)
    if (platformStr.includes('intel') || /intel/.test(userAgent)) {
      return 'x64';
    }
  }

  // Default: assume x64 for desktop platforms (most common)
  const platform = detectDevicePlatform();
  if (platform === 'windows' || platform === 'linux') {
    return 'x64'; // Default assumption for desktop
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

// CPU architecture atom - starts as 'unknown', will be updated after detection
const _cpuArchitectureAtomBase = atom<CpuArchitecture>('unknown');

export const cpuArchitectureAtom = atom(
  (get) => get(_cpuArchitectureAtomBase),
  (get, set, update: CpuArchitecture) => {
    set(_cpuArchitectureAtomBase, update);
  },
);

// Initialize CPU architecture detection on client side
if (typeof window !== 'undefined') {
  detectCpuArchitecture()
    .then((arch) => {
      // Update atom when detection completes
      // Note: This requires the atom to be used in a component context
      // For immediate use, components should call detectCpuArchitecture() directly
    })
    .catch((error) => {
      console.debug('CPU architecture detection failed:', error);
    });
}

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
