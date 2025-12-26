'use client';

import { Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useEffect, useState } from 'react';
import { localeAtom, detectLocale } from '@/atoms';
import type { Locale } from '@/i18n/locales';

function HydrateAtoms(props: { locale: Locale; children: React.ReactNode }) {
  useHydrateAtoms([[localeAtom, props.locale]]);
  return <>{props.children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocale(detectLocale());
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <Provider>
      <HydrateAtoms locale={locale}>{children}</HydrateAtoms>
    </Provider>
  );
}

