'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { useRef, useState, useEffect } from 'react';
import { translationsAtom, localeAtom, themeAtom, devicePlatformAtom } from '@/atoms';
import { ThemeSwitcher, LanguageSwitcher } from '@/components';
import { getAppStoreBadgePath, getAppleLogoPath, getAppIconPath, getPlatformIconPath } from '@/utils';
import styles from './page.module.css';

export default function Home() {
  const t = useAtomValue(translationsAtom);
  const locale = useAtomValue(localeAtom);
  const theme = useAtomValue(themeAtom);
  const platform = useAtomValue(devicePlatformAtom);
  const allPlatformsRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const features = [
    { icon: '📴', title: t.featureOffline, desc: t.featureOfflineDesc },
    { icon: '🔒', title: t.featurePrivacy, desc: t.featurePrivacyDesc },
    { icon: '🌐', title: t.featureCrossplatform, desc: t.featureCrossplatformDesc },
    { icon: '⚡', title: t.featureAcceleration, desc: t.featureAccelerationDesc },
    { icon: '🎨', title: t.featureMultimodal, desc: t.featureMultimodalDesc },
  ];

  const appleLogoPath = getAppleLogoPath({ theme });
  const appStoreBadgePath = getAppStoreBadgePath({ locale, theme });

  // 根据设备平台获取对应的下载选项
  const getSmartDownloadOptions = () => {
    switch (platform) {
      case 'ios':
        return {
          platformName: t.ios,
          platformIcon: getAppleLogoPath({ theme }),
          downloads: [
            {
              type: 'testflight',
              label: t.testFlight,
              href: 'https://testflight.apple.com/join/DaMqCNKh',
            },
            {
              type: 'app-store',
              label: t.appStore,
              href: 'https://apps.apple.com/app/rwkv-chat/id6740192639',
              badge: appStoreBadgePath,
            },
          ],
        };
      case 'android':
        return {
          platformName: t.android,
          platformIcon: getPlatformIconPath({ platform: 'android' }),
          downloads: [
            {
              type: 'apk',
              label: t.apk,
              href: '#android-apk',
            },
            {
              type: 'play-store',
              label: t.playStore,
              href: 'https://play.google.com/store/apps/details?id=com.rwkvzone.chat',
              badge: '/images/badges/play-store/get-it-on-google-play.png',
            },
          ],
        };
      case 'windows':
        return {
          platformName: t.windows,
          platformIcon: getPlatformIconPath({ platform: 'windows' }),
          downloads: [
            {
              type: 'installer',
              label: t.installer,
              href: '#windows-installer',
            },
            {
              type: 'zip',
              label: t.zip,
              href: '#windows-zip',
            },
          ],
        };
      case 'macos':
        return {
          platformName: t.macos,
          platformIcon: getAppleLogoPath({ theme }),
          downloads: [
            {
              type: 'dmg',
              label: t.dmg,
              href: '#macos-dmg',
            },
          ],
        };
      case 'linux':
        return {
          platformName: t.linux,
          platformIcon: getPlatformIconPath({ platform: 'linux' }),
          downloads: [
            {
              type: 'appimage',
              label: 'AppImage',
              href: '#linux-appimage',
            },
          ],
        };
      default:
        return null;
    }
  };

  const smartDownloadOptions = getSmartDownloadOptions();

  // 滚动到所有平台区域
  const scrollToAllPlatforms = () => {
    if (allPlatformsRef.current) {
      allPlatformsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const platforms = {
    mobile: [
      {
        name: t.android,
        icon: '/images/platforms/android.svg',
        minOs: t.androidRequirement,
        downloads: [
          {
            type: 'apk',
            label: t.apk,
            href: '#android-apk',
          },
          {
            type: 'play-store',
            label: t.playStore,
            href: 'https://play.google.com/store/apps/details?id=com.rwkvzone.chat',
            badge: '/images/badges/play-store/get-it-on-google-play.png',
          },
        ],
      },
      {
        name: t.ios,
        icon: appleLogoPath,
        minOs: t.iosRequirement,
        downloads: [
          {
            type: 'testflight',
            label: t.testFlight,
            href: 'https://testflight.apple.com/join/DaMqCNKh',
          },
          {
            type: 'app-store',
            label: t.appStore,
            href: 'https://apps.apple.com/app/rwkv-chat/id6740192639',
            badge: appStoreBadgePath,
          },
        ],
      },
    ],
    desktop: [
      {
        name: t.macos,
        icon: appleLogoPath,
        minOs: t.macosRequirement,
        downloads: [
          {
            type: 'dmg',
            label: t.dmg,
            href: '#macos-dmg',
          },
        ],
      },
      {
        name: t.windows,
        icon: '/images/platforms/windows-logo.png',
        minOs: t.windowsRequirement,
        downloads: [
          {
            type: 'installer',
            label: t.installer,
            href: '#windows-installer',
          },
          {
            type: 'zip',
            label: t.zip,
            href: '#windows-zip',
          },
        ],
      },
      {
        name: t.linux,
        icon: '/images/platforms/linux.png',
        minOs: t.linuxRequirement,
        downloads: [
          {
            type: 'appimage',
            label: 'AppImage',
            href: '#linux-appimage',
          },
        ],
      },
    ],
  };

  return (
    <main className={styles.main}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroIcon}>
            <Image
              src={getAppIconPath()}
              alt={t.appName}
              width={120}
              height={120}
              className={styles.appIconImage}
              priority
            />
          </div>
          <h1 className={styles.appName}>{t.appName}</h1>
          <p className={styles.tagline}>{t.appTagline}</p>
          <p className={styles.description}>{t.appDescription}</p>
        </section>

        {/* Smart Download Section */}
        {mounted && smartDownloadOptions && (
          <section className={styles.smartDownloadSection}>
            <div className={styles.smartDownloadContent}>
              <div className={styles.smartDownloadHeader}>
                <Image
                  src={smartDownloadOptions.platformIcon}
                  alt={smartDownloadOptions.platformName}
                  width={32}
                  height={32}
                  className={styles.smartDownloadPlatformIcon}
                />
                <h2 className={styles.smartDownloadTitle}>{t.smartDownload}</h2>
              </div>
              <p className={styles.smartDownloadDesc}>{t.downloadForYourDevice}</p>
              <div className={styles.smartDownloadButtons}>
                {smartDownloadOptions.downloads.map((download) => (
                  <a
                    key={download.type}
                    href={download.href}
                    className={`${styles.downloadButton} ${download.badge ? styles.badgeButton : ''}`}
                    target={download.href.startsWith('http') ? '_blank' : undefined}
                    rel={download.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    {download.badge ? (
                      <Image
                        src={download.badge}
                        alt={download.label}
                        width={155}
                        height={60}
                        className={styles.badgeImage}
                        unoptimized
                      />
                    ) : (
                      <>
                        <span>{download.label}</span>
                        <svg
                          className={styles.arrowIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </a>
                ))}
              </div>
              <button
                onClick={scrollToAllPlatforms}
                className={styles.otherPlatformsButton}
                type="button"
              >
                {t.downloadOtherPlatforms}
                <svg
                  className={styles.arrowIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* All Platforms Section */}
        <div ref={allPlatformsRef}>
          {/* Download Section - Mobile */}
        <section className={styles.downloadSection}>
          <div className={styles.downloadContent}>
            <div className={styles.downloadText}>
              <h2 className={styles.downloadTitle}>{t.mobile}</h2>
              <p className={styles.downloadDesc}>{t.mobileDesc}</p>
              <div className={styles.downloadButtons}>
                {platforms.mobile.map((platform) => (
                  <div key={platform.name} className={styles.platformGroup}>
                    <div className={styles.platformLabel}>{platform.name}</div>
                    <div className={styles.platformGroupButtons}>
                      {platform.downloads.map((download) => (
                        <a
                          key={download.type}
                          href={download.href}
                          className={`${styles.downloadButton} ${download.badge ? styles.badgeButton : ''}`}
                          target={download.href.startsWith('http') ? '_blank' : undefined}
                          rel={download.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          {download.badge ? (
                            <Image
                              src={download.badge}
                              alt={download.label}
                              width={155}
                              height={60}
                              className={styles.badgeImage}
                              unoptimized
                            />
                          ) : (
                            <>
                              <span>{download.label}</span>
                              <svg
                                className={styles.arrowIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.previewArea}>
              <div className={styles.mobilePreview}>
                <div className={styles.mobileFrame}>
                  <div className={styles.mobileHeader}>
                    <span className={styles.mobileTime}>15:08</span>
                    <div className={styles.mobileStatus}>
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className={styles.mobileContent}>
                    <div className={styles.mobileLogo}>RWKV</div>
                    <div className={styles.mobileText}>Ask RWKV, Know More</div>
                    <div className={styles.mobileInput}>
                      <span>How can I help you today?</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Download Section - Desktop */}
        <section className={styles.downloadSection}>
          <div className={styles.downloadContent}>
            <div className={styles.downloadText}>
              <h2 className={styles.downloadTitle}>{t.desktop}</h2>
              <p className={styles.downloadDesc}>{t.desktopDesc}</p>
              <div className={styles.downloadButtons}>
                {platforms.desktop.map((platform) => (
                  <div key={platform.name} className={styles.platformGroup}>
                    <div className={styles.platformLabel}>{platform.name}</div>
                    {platform.downloads.map((download) => (
                      <a
                        key={download.type}
                        href={download.href}
                        className={styles.downloadButton}
                        target={download.href.startsWith('http') ? '_blank' : undefined}
                        rel={download.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        <span>{download.label}</span>
                        <svg
                          className={styles.arrowIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.previewArea}>
              <div className={styles.desktopPreview}>
                <div className={styles.desktopFrame}>
                  <div className={styles.desktopTitleBar}>
                    <div className={styles.desktopControls}>
                      <span className={styles.controlDot}></span>
                      <span className={styles.controlDot}></span>
                      <span className={styles.controlDot}></span>
                    </div>
                    <span className={styles.desktopTitle}>RWKV Chat</span>
                  </div>
                  <div className={styles.desktopContent}>
                    <div className={styles.desktopLogo}>RWKV</div>
                    <div className={styles.desktopText}>Ask RWKV, Know More</div>
                    <div className={styles.desktopInput}>
                      <span>How can I help you today?</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

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
