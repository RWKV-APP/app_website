'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { localeAtom } from '@/atoms';
import { locales, localeNames, type Locale } from '@/i18n/locales';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher() {
  const [locale, setLocale] = useAtom(localeAtom);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((loc: Locale) => {
    setLocale(loc);
    setOpen(false);
  }, [setLocale]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <svg className={styles.globeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className={styles.triggerLabel}>{localeNames[locale]}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} role="listbox" aria-activedescendant={locale}>
          {locales.map((loc) => (
            <button
              key={loc}
              className={`${styles.menuItem} ${loc === locale ? styles.menuItemSelected : ''}`}
              onClick={() => handleSelect(loc)}
              type="button"
              role="option"
              aria-selected={loc === locale}
              id={loc}
            >
              <span className={styles.checkmark}>
                {loc === locale && (
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                  </svg>
                )}
              </span>
              <span>{localeNames[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
