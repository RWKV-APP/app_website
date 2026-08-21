'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Theme } from '@/atoms';
import { getHomePageCopy, type Locale } from '@/i18n';
import styles from './RuntimeShowcase.module.css';

type ShowcaseDevice = 'desktop' | 'mobile';
type CaptureLocale = 'zh-CN' | 'en';

interface RuntimeShowcaseProps {
  locale: Locale;
  theme: Theme;
}

const SHOWCASE_ROOT = '/images/showcase/rwkv-chat/4.7.0';
const MOBILE_SHOWCASE_QUERY = '(max-width: 734px)';

function getCaptureLocale(locale: Locale): CaptureLocale {
  return locale === 'zh-CN' || locale === 'zh-TW' ? 'zh-CN' : 'en';
}

function getResolvedDocumentTheme(): Theme {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme === 'light' || explicitTheme === 'dark') {
    return explicitTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function RuntimeShowcase({ locale, theme }: RuntimeShowcaseProps) {
  const [device, setDevice] = useState<ShowcaseDevice | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<Theme | null>(null);
  const copy = getHomePageCopy(locale);
  const captureLocale = getCaptureLocale(locale);
  const imageWidth = device === 'mobile' ? 1200 : 800;
  const imageHeight = device === 'mobile' ? 2500 : 600;
  const imageBase =
    resolvedTheme && device ? `${SHOWCASE_ROOT}/${device}-${captureLocale}-${resolvedTheme}` : null;

  useEffect(() => {
    const mobileLayout = window.matchMedia(MOBILE_SHOWCASE_QUERY);
    const updateDevice = (isMobile: boolean) => {
      setDevice(isMobile ? 'mobile' : 'desktop');
    };
    const handleLayoutChange = (event: MediaQueryListEvent) => {
      updateDevice(event.matches);
    };

    updateDevice(mobileLayout.matches);
    mobileLayout.addEventListener('change', handleLayoutChange);

    return () => mobileLayout.removeEventListener('change', handleLayoutChange);
  }, []);

  useEffect(() => {
    // Theme and locale preferences are restored by Providers after hydration.
    // Wait until that effect has settled so the static light-theme fallback never downloads.
    const frame = window.requestAnimationFrame(() => {
      setResolvedTheme(getResolvedDocumentTheme());
    });

    return () => window.cancelAnimationFrame(frame);
  }, [locale, theme]);

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.stage} aria-busy={resolvedTheme === null || device === null}>
          <figure className={styles.scene}>
            <div className={styles.imageFrame}>
              {imageBase && (
                <Image
                  key={`${imageBase}-normal`}
                  src={`${imageBase}-normal.webp`}
                  alt={copy.showcaseNormalAlt}
                  width={imageWidth}
                  height={imageHeight}
                  sizes={
                    device === 'desktop'
                      ? '(max-width: 734px) calc(100vw - 40px), 460px'
                      : '(max-width: 734px) calc(100vw - 40px), 340px'
                  }
                  className={styles.screenshot}
                  decoding="async"
                  loading="eager"
                />
              )}
            </div>
            <figcaption className={styles.caption}>
              <strong>{copy.showcaseNormalTitle}</strong>
              <span>{copy.showcaseNormalDescription}</span>
            </figcaption>
          </figure>

          <figure className={styles.scene}>
            <div className={styles.imageFrame}>
              {imageBase && (
                <Image
                  key={`${imageBase}-g1i-concurrent`}
                  src={`${imageBase}-g1i-concurrent.webp`}
                  alt={copy.showcaseConcurrentAlt}
                  width={imageWidth}
                  height={imageHeight}
                  sizes={
                    device === 'desktop'
                      ? '(max-width: 734px) calc(100vw - 40px), 460px'
                      : '(max-width: 734px) calc(100vw - 40px), 340px'
                  }
                  className={styles.screenshot}
                  decoding="async"
                  loading="lazy"
                />
              )}
            </div>
            <figcaption className={styles.caption}>
              <strong>{copy.showcaseConcurrentTitle}</strong>
              <span>{copy.showcaseConcurrentDescription}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
