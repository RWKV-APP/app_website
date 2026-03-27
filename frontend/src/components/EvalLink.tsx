'use client';

import Link from 'next/link';
import styles from './EvalLink.module.css';

export function EvalLink() {
  return (
    <Link href="/admin/eval" className={styles.evalLink} aria-label="Eval Browser" title="Eval Browser">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="M7 15l3-3 3 2 4-5" />
        <circle cx="7" cy="15" r="1" />
        <circle cx="10" cy="12" r="1" />
        <circle cx="13" cy="14" r="1" />
        <circle cx="17" cy="9" r="1" />
      </svg>
      <span className={styles.label}>Eval</span>
    </Link>
  );
}
