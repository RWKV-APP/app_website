'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAtom, useAtomValue } from 'jotai';
import {
  translationsAtom,
  localeAtom,
  locationAtom,
  detectLocale,
} from '@/atoms';
import { fetchAllReleaseNotes, type ReleaseNote } from '@/utils/api';
import { fetchLocation } from '@/utils';
import { detectLocaleFromLocation, type Locale } from '@/i18n/locales';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

export default function ReleaseNotesPage() {
  const t = useAtomValue(translationsAtom);
  const [locale, setLocale] = useAtom(localeAtom);
  const [location, setLocation] = useAtom(locationAtom);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const locationDetectedRef = useRef(false);
  const browserDefaultLocaleRef = useRef<Locale | null>(null);

  useEffect(() => {
    setMounted(true);
    // Store browser default locale on mount
    if (typeof window !== 'undefined') {
      browserDefaultLocaleRef.current = detectLocale();
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      // Detect user location
      if (!location && !locationDetectedRef.current) {
        locationDetectedRef.current = true;
        fetchLocation()
          .then((locationData) => {
            if (locationData) {
              setLocation(locationData);

              // Auto-detect locale from location
              // Only set if current locale is still the browser default (user hasn't manually changed it)
              const currentLocale = locale;
              const browserDefault = browserDefaultLocaleRef.current;
              if (browserDefault && currentLocale === browserDefault) {
                const detectedLocale = detectLocaleFromLocation(locationData);
                if (detectedLocale && detectedLocale !== currentLocale) {
                  setLocale(detectedLocale);
                }
              }
            }
          })
          .catch((error) => {
            console.error('Failed to detect location:', error);
          });
      }
    }
  }, [mounted, location, setLocation, setLocale, locale]);

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllReleaseNotes({ locale });
        setReleaseNotes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load release notes');
      } finally {
        setLoading(false);
      }
    };

    if (mounted) {
      loadReleaseNotes();
    }
  }, [mounted, locale]);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          {t.backToDownload}
        </Link>

        <h1 className={styles.title}>{t.releaseNotes}</h1>
        <p className={styles.description}>{t.releaseNotesDescription}</p>

        {loading && <div className={styles.loading}>Loading...</div>}
        {error && <div className={styles.error}>Error: {error}</div>}

        {!loading && !error && releaseNotes.length === 0 && (
          <div className={styles.loading}>No release notes available.</div>
        )}

        {!loading && !error && releaseNotes.length > 0 && (
          <div className={styles.timeline}>
            {releaseNotes.map((note) => (
              <article key={`${note.build}-${note.version}`} className={styles.entry}>
                <header className={styles.entryHeader}>
                  <h2 className={styles.version}>v{note.version}</h2>
                  <span className={styles.build}>Build {note.build}</span>
                </header>
                <div className={styles.content}>
                  <ReactMarkdown>{note.content}</ReactMarkdown>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
