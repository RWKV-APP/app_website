'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { translationsAtom } from '@/atoms';
import type { Translations } from '@/i18n/translations';

type ChangeType = 'feature' | 'fix' | 'improvement' | 'breaking';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: ChangeType;
    descriptionKey: keyof Translations;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2025-12-26',
    changes: [
      { type: 'feature', descriptionKey: 'darkModeSupport' },
      { type: 'feature', descriptionKey: 'macosUniversal' },
      { type: 'improvement', descriptionKey: 'uiOptimization' },
      { type: 'fix', descriptionKey: 'windowsCrashFix' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-20',
    changes: [
      { type: 'feature', descriptionKey: 'linuxSupport' },
      { type: 'feature', descriptionKey: 'windowsSupport' },
      { type: 'improvement', descriptionKey: 'startupSpeedUp' },
      { type: 'fix', descriptionKey: 'iosNotificationFix' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-01',
    changes: [
      { type: 'feature', descriptionKey: 'initialRelease' },
      { type: 'feature', descriptionKey: 'androidIosSupport' },
      { type: 'feature', descriptionKey: 'macosSupport' },
    ],
  },
];

export default function ChangelogPage() {
  const t = useAtomValue(translationsAtom);

  const typeLabels: Record<ChangeType, { label: string; className: string }> = {
    feature: { label: t.feature, className: styles.tagFeature },
    fix: { label: t.fix, className: styles.tagFix },
    improvement: { label: t.improvement, className: styles.tagImprovement },
    breaking: { label: t.breaking, className: styles.tagBreaking },
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          {t.backToDownload}
        </Link>

        <h1 className={styles.title}>{t.changelog}</h1>
        <p className={styles.description}>{t.changelogDescription}</p>

        <div className={styles.timeline}>
          {changelog.map((entry) => (
            <article key={entry.version} className={styles.entry}>
              <header className={styles.entryHeader}>
                <h2 className={styles.version}>v{entry.version}</h2>
                <time className={styles.date}>{entry.date}</time>
              </header>
              <ul className={styles.changeList}>
                {entry.changes.map((change, index) => (
                  <li key={index} className={styles.changeItem}>
                    <span className={`${styles.tag} ${typeLabels[change.type].className}`}>
                      {typeLabels[change.type].label}
                    </span>
                    <span className={styles.changeDescription}>{t[change.descriptionKey]}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
