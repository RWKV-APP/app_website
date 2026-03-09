'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminSession, loginAdmin } from '@/utils';
import styles from './page.module.css';

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Login failed';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [nextPath, setNextPath] = useState('/admin/configs');

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const requestedNext =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next') || '/admin/configs'
          : '/admin/configs';
      const safeNextPath = requestedNext.startsWith('/') ? requestedNext : '/admin/configs';

      if (!cancelled) {
        setNextPath(safeNextPath);
      }

      try {
        const session = await fetchAdminSession();
        if (!cancelled && session) {
          router.replace(safeNextPath);
          return;
        }
      } catch {
        // Ignore invalid local tokens and stay on login page.
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await loginAdmin({
        username,
        password,
      });
      router.replace(nextPath);
    } catch (nextError) {
      setError(normalizeError(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Admin Access</p>
        <h1 className={styles.title}>Sign in to Remote Config Admin</h1>
        <p className={styles.description}>
          Use the configured admin username and password to manage uploaded JSON versions and
          published config state.
        </p>

        {checkingSession ? (
          <p className={styles.status}>Checking existing session...</p>
        ) : (
          <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
            <label className={styles.field}>
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="admin"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="********"
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        <p className={styles.note}>After sign-in, you will be redirected to {nextPath}.</p>
      </section>
    </main>
  );
}
