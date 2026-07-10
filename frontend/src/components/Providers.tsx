'use client';

import { createStore, Provider, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import {
  localeAtom,
  systemThemeAtom,
  themePreferenceAtom,
  detectLocale,
  getInitialThemePreference,
  getStoredLocalePreference,
} from '@/atoms';

function PreferenceSync() {
  const locale = useAtomValue(localeAtom);
  const setLocale = useSetAtom(localeAtom);
  const setSystemTheme = useSetAtom(systemThemeAtom);
  const setThemePreference = useSetAtom(themePreferenceAtom);

  useEffect(() => {
    const initialLocale = getStoredLocalePreference() || detectLocale();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      setSystemTheme(systemTheme);

      if (getInitialThemePreference() === 'system') {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.colorScheme = systemTheme;
      }
    };

    setLocale(initialLocale);
    setThemePreference(getInitialThemePreference());
    syncSystemTheme();
    mediaQuery.addEventListener('change', syncSystemTheme);

    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, [setLocale, setSystemTheme, setThemePreference]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createStore();
  }

  return (
    <Provider store={storeRef.current}>
      <PreferenceSync />
      {children}
    </Provider>
  );
}
