'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { translationsAtom } from '@/atoms';
import { fetchAllReleaseNotes, type ReleaseNote } from '@/utils/api';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

export default function ReleaseNotesPage() {
  const t = useAtomValue(translationsAtom);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllReleaseNotes();
        setReleaseNotes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load release notes');
      } finally {
        setLoading(false);
      }
    };

    loadReleaseNotes();
  }, []);

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
