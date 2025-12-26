'use client';

import { Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useEffect, useState } from 'react';
import { localeAtom, themePreferenceAtom, detectLocale, getInitialThemePreference } from '@/atoms';
import type { Locale } from '@/i18n/locales';

function HydrateAtoms(props: { locale: Locale; themePreference: string; children: React.ReactNode }) {
  useHydrateAtoms([
    [localeAtom, props.locale],
    [themePreferenceAtom, props.themePreference as any],
  ]);
  return <>{props.children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [themePreference, setThemePreference] = useState<string>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocale(detectLocale());
    if (typeof window !== 'undefined') {
      setThemePreference(getInitialThemePreference());
    }
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <Provider>
      <HydrateAtoms locale={locale} themePreference={themePreference}>
        {children}
      </HydrateAtoms>
    </Provider>
  );
}

