'use client';

import { useAtom } from 'jotai';
import { localeAtom } from '@/atoms';
import { locales, localeNames, type Locale } from '@/i18n/locales';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher() {
  const [locale, setLocale] = useAtom(localeAtom);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(e.target.value as Locale);
  };

  return (
    <div className={styles.wrapper}>
      <select className={styles.select} value={locale} onChange={handleChange}>
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
