'use client';

import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { translationsAtom } from '@/atoms';
import styles from './page.module.css';

export default function Home() {
  const t = useAtomValue(translationsAtom);

  const features = [
    { icon: '📴', title: t.featureOffline, desc: t.featureOfflineDesc },
    { icon: '🔒', title: t.featurePrivacy, desc: t.featurePrivacyDesc },
    { icon: '🌐', title: t.featureCrossplatform, desc: t.featureCrossplatformDesc },
    { icon: '⚡', title: t.featureAcceleration, desc: t.featureAccelerationDesc },
    { icon: '🎨', title: t.featureMultimodal, desc: t.featureMultimodalDesc },
  ];

  const platforms = {
    mobile: [
      { name: t.android, icon: '🤖', arch: t.androidRequirement, href: '#android' },
      { name: t.ios, icon: '🍎', arch: t.iosRequirement, href: '#ios' },
    ],
    desktop: [
      { name: t.macos, icon: '🖥️', arch: t.macosRequirement, href: '#macos' },
      { name: t.windows, icon: '🪟', arch: t.windowsRequirement, href: '#windows' },
      { name: t.linux, icon: '🐧', arch: t.linuxRequirement, href: '#linux' },
    ],
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <h1 className={styles.appName}>{t.appName}</h1>
          <p className={styles.tagline}>{t.appTagline}</p>
          <p className={styles.description}>{t.appDescription}</p>
        </section>

        {/* Features Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.features}</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Download Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.downloadNow}</h2>

          {/* Mobile Platforms */}
          <div className={styles.platformSection}>
            <h3 className={styles.platformTitle}>{t.mobile}</h3>
            <div className={styles.platformGrid}>
              {platforms.mobile.map((platform) => (
                <a key={platform.name} href={platform.href} className={styles.platformCard}>
                  <span className={styles.platformIcon}>{platform.icon}</span>
                  <span className={styles.platformName}>{platform.name}</span>
                  <span className={styles.platformArch}>{platform.arch}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Desktop Platforms */}
          <div className={styles.platformSection}>
            <h3 className={styles.platformTitle}>{t.desktop}</h3>
            <div className={styles.platformGrid}>
              {platforms.desktop.map((platform) => (
                <a key={platform.name} href={platform.href} className={styles.platformCard}>
                  <span className={styles.platformIcon}>{platform.icon}</span>
                  <span className={styles.platformName}>{platform.name}</span>
                  <span className={styles.platformArch}>{platform.arch}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Open Source Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.openSource}</h2>
          <p className={styles.openSourceDesc}>{t.openSourceDesc}</p>
          <a
            href="https://github.com/RWKV-APP/RWKV_APP"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubButton}
          >
            <svg className={styles.githubIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {t.viewOnGithub}
          </a>
        </section>

        {/* Footer */}
        <div className={styles.footer}>
          <Link href="/changelog" className={styles.changelogLink}>
            {t.viewChangelog}
          </Link>
        </div>
      </div>
    </main>
  );
}
