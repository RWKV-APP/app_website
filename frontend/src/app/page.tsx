'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import {
  translationsAtom,
  localeAtom,
  themeAtom,
  devicePlatformAtom,
  locationAtom,
  detectLocale,
  detectCpuArchitecture,
  type CpuArchitecture,
} from '@/atoms';
import { ThemeSwitcher, LanguageSwitcher, GitHubLink, ReleaseNotesLink } from '@/components';
import {
  getAppStoreBadgePath,
  getAppleLogoPath,
  getAppIconPath,
  getPlatformIconPath,
  getGooglePlayBadgePath,
  fetchLatestDistributions,
  readCachedLatestDistributions,
  fetchLocation,
} from '@/utils';
import { detectLocaleFromLocation, type Locale } from '@/i18n/locales';
import { LatestDistributionsResponse, DistributionType } from '@/types/distribution';
import styles from './page.module.css';

interface DownloadOption {
  type: string;
  label: string;
  href: string;
  available: boolean;
  version?: string;
  badge?: string;
}

interface PlatformOption {
  name: string;
  icon: string;
  minOs: string;
  downloads: DownloadOption[];
  x64Downloads?: DownloadOption[];
  arm64Downloads?: DownloadOption[];
}

interface SmartDownloadOption {
  platformName: string;
  platformIcon: string;
  downloads: DownloadOption[];
}

function parseDownloadLabel(label: string) {
  const matched = label.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
  let title = matched?.[1]?.trim() || label;
  const source = matched?.[2]?.trim() || null;
  const hasArm64 = /\bARM64\b/i.test(title);

  if (hasArm64) {
    title = title.replace(/\s*ARM64\b/i, '').trim();
  }

  return {
    title,
    source,
    architecture: hasArm64 ? 'ARM64' : null,
  };
}

function getDownloadVersion(version?: string) {
  if (!version) {
    return null;
  }

  const normalized = version.trim();
  if (!normalized || normalized === 'latest') {
    return null;
  }

  return `v${normalized}`;
}

export default function Home() {
  const t = useAtomValue(translationsAtom);
  const [locale, setLocale] = useAtom(localeAtom);
  const theme = useAtomValue(themeAtom);
  const platform = useAtomValue(devicePlatformAtom);
  const [location, setLocation] = useAtom(locationAtom);
  const smartDownloadRef = useRef<HTMLElement>(null);
  const allPlatformsRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [distributions, setDistributions] = useState<LatestDistributionsResponse | null>(null);
  const [cpuArchitecture, setCpuArchitecture] = useState<CpuArchitecture>('unknown');
  const locationDetectedRef = useRef(false);
  const browserDefaultLocaleRef = useRef<Locale | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      browserDefaultLocaleRef.current = detectLocale();
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let isCancelled = false;
    const cachedDistributions = readCachedLatestDistributions();
    if (cachedDistributions) {
      setDistributions(cachedDistributions);
    }

    fetchLatestDistributions()
      .then((data) => {
        if (!isCancelled) {
          setDistributions(data);
        }
      })
      .catch((error) => {
        console.error('Failed to load distributions:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let isCancelled = false;

    if (!location && !locationDetectedRef.current) {
      locationDetectedRef.current = true;
      fetchLocation()
          .then((locationData) => {
            if (locationData && !isCancelled) {
              setLocation(locationData);

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

    return () => {
      isCancelled = true;
    };
  }, [mounted, location, setLocation, setLocale, locale]);

  useEffect(() => {
    if (!mounted || platform !== 'windows') {
      setCpuArchitecture('unknown');
      return;
    }

    let isCancelled = false;

    detectCpuArchitecture()
      .then((arch) => {
        if (!isCancelled) {
          setCpuArchitecture(arch);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCpuArchitecture('unknown');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [mounted, platform]);

  const features = [
    { icon: '📴', title: t.featureOffline, desc: t.featureOfflineDesc },
    { icon: '🔒', title: t.featurePrivacy, desc: t.featurePrivacyDesc },
    { icon: '🌐', title: t.featureCrossplatform, desc: t.featureCrossplatformDesc },
    { icon: '⚡', title: t.featureAcceleration, desc: t.featureAccelerationDesc },
    { icon: '🎨', title: t.featureMultimodal, desc: t.featureMultimodalDesc },
  ];

  const appleLogoPath = mounted
    ? getAppleLogoPath({ theme })
    : getAppleLogoPath({ theme: 'light' });
  const appStoreBadgePath = mounted
    ? getAppStoreBadgePath({ locale, theme })
    : getAppStoreBadgePath({ locale, theme: 'light' });
  const googlePlayBadgePath = getGooglePlayBadgePath({ locale });

  const getSmartDownloadOptions = (): SmartDownloadOption | null => {
    if (!mounted || !platform) {
      return null;
    }

    switch (platform) {
      case 'ios':
        return {
          platformName: t.ios,
          platformIcon: getAppleLogoPath({ theme }),
          downloads: [
            {
              type: 'iOSTF',
              label: t.testFlight,
              href:
                distributions?.[DistributionType.iOSTF]?.url ||
                'https://testflight.apple.com/join/DaMqCNKh',
              available: true,
              version: distributions?.[DistributionType.iOSTF]?.version,
            },
            {
              type: 'iOSAS',
              label: t.appStore,
              href:
                distributions?.[DistributionType.iOSAS]?.url ||
                'https://apps.apple.com/app/rwkv-chat/id6740192639',
              badge: appStoreBadgePath,
              available: !!distributions?.[DistributionType.iOSAS],
              version: distributions?.[DistributionType.iOSAS]?.version,
            },
          ],
        };
      case 'android':
        return {
          platformName: t.android,
          platformIcon: getPlatformIconPath({ platform: 'android' }),
          downloads: [
            {
              type: 'androidHF',
              label: 'HuggingFace',
              href: distributions?.[DistributionType.androidHF]?.url || '#',
              available: !!distributions?.[DistributionType.androidHF],
              version: distributions?.[DistributionType.androidHF]?.version,
            },
            {
              type: 'androidAF',
              label: 'Aifasthub',
              href: distributions?.[DistributionType.androidAF]?.url || '#',
              available: !!distributions?.[DistributionType.androidAF],
              version: distributions?.[DistributionType.androidAF]?.version,
            },
            {
              type: 'androidGR',
              label: 'GitHub Release',
              href: distributions?.[DistributionType.androidGR]?.url || '#',
              available: !!distributions?.[DistributionType.androidGR],
              version: distributions?.[DistributionType.androidGR]?.version,
            },
            {
              type: 'androidHFM',
              label: 'HF-Mirror',
              href: distributions?.[DistributionType.androidHFM]?.url || '#',
              available: !!distributions?.[DistributionType.androidHFM],
              version: distributions?.[DistributionType.androidHFM]?.version,
            },
            {
              type: 'androidPgyer',
              label: 'Pgyer',
              href: distributions?.[DistributionType.androidPgyer]?.url || '#',
              available: !!distributions?.[DistributionType.androidPgyer],
              version: distributions?.[DistributionType.androidPgyer]?.version,
            },
            {
              type: 'androidGooglePlay',
              label: t.playStore,
              href:
                distributions?.[DistributionType.androidGooglePlay]?.url ||
                'https://play.google.com/store/apps/details?id=com.rwkvzone.chat',
              badge: googlePlayBadgePath,
              available: !!distributions?.[DistributionType.androidGooglePlay],
              version: distributions?.[DistributionType.androidGooglePlay]?.version,
            },
          ],
        };
      case 'windows':
        return {
          platformName: t.windows,
          platformIcon: getPlatformIconPath({ platform: 'windows' }),
          downloads: [
            {
              type: 'winHF',
              label: 'Installer (HuggingFace)',
              href: distributions?.[DistributionType.winHF]?.url || '#',
              available: !!distributions?.[DistributionType.winHF],
              version: distributions?.[DistributionType.winHF]?.version,
            },
            {
              type: 'winAF',
              label: 'Installer (Aifasthub)',
              href: distributions?.[DistributionType.winAF]?.url || '#',
              available: !!distributions?.[DistributionType.winAF],
              version: distributions?.[DistributionType.winAF]?.version,
            },
            {
              type: 'winGR',
              label: 'Installer (GitHub Release)',
              href: distributions?.[DistributionType.winGR]?.url || '#',
              available: !!distributions?.[DistributionType.winGR],
              version: distributions?.[DistributionType.winGR]?.version,
            },
            {
              type: 'winHFM',
              label: 'Installer (HF-Mirror)',
              href: distributions?.[DistributionType.winHFM]?.url || '#',
              available: !!distributions?.[DistributionType.winHFM],
              version: distributions?.[DistributionType.winHFM]?.version,
            },
            {
              type: 'winZipHF',
              label: 'Zip 免安装 (HuggingFace)',
              href: distributions?.[DistributionType.winZipHF]?.url || '#',
              available: !!distributions?.[DistributionType.winZipHF],
              version: distributions?.[DistributionType.winZipHF]?.version,
            },
            {
              type: 'winZipAF',
              label: 'Zip 免安装 (Aifasthub)',
              href: distributions?.[DistributionType.winZipAF]?.url || '#',
              available: !!distributions?.[DistributionType.winZipAF],
              version: distributions?.[DistributionType.winZipAF]?.version,
            },
            {
              type: 'winZipGR',
              label: 'Zip 免安装 (GitHub Release)',
              href: distributions?.[DistributionType.winZipGR]?.url || '#',
              available: !!distributions?.[DistributionType.winZipGR],
              version: distributions?.[DistributionType.winZipGR]?.version,
            },
            {
              type: 'winZipHFM',
              label: 'Zip 免安装 (HF-Mirror)',
              href: distributions?.[DistributionType.winZipHFM]?.url || '#',
              available: !!distributions?.[DistributionType.winZipHFM],
              version: distributions?.[DistributionType.winZipHFM]?.version,
            },
            {
              type: 'winArm64HF',
              label: 'Installer ARM64 (HuggingFace)',
              href: distributions?.[DistributionType.winArm64HF]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64HF],
              version: distributions?.[DistributionType.winArm64HF]?.version,
            },
            {
              type: 'winArm64AF',
              label: 'Installer ARM64 (Aifasthub)',
              href: distributions?.[DistributionType.winArm64AF]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64AF],
              version: distributions?.[DistributionType.winArm64AF]?.version,
            },
            {
              type: 'winArm64GR',
              label: 'Installer ARM64 (GitHub Release)',
              href: distributions?.[DistributionType.winArm64GR]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64GR],
              version: distributions?.[DistributionType.winArm64GR]?.version,
            },
            {
              type: 'winArm64HFM',
              label: 'Installer ARM64 (HF-Mirror)',
              href: distributions?.[DistributionType.winArm64HFM]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64HFM],
              version: distributions?.[DistributionType.winArm64HFM]?.version,
            },
            {
              type: 'winArm64ZipHF',
              label: 'Zip 免安装 ARM64 (HuggingFace)',
              href: distributions?.[DistributionType.winArm64ZipHF]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64ZipHF],
              version: distributions?.[DistributionType.winArm64ZipHF]?.version,
            },
            {
              type: 'winArm64ZipAF',
              label: 'Zip 免安装 ARM64 (Aifasthub)',
              href: distributions?.[DistributionType.winArm64ZipAF]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64ZipAF],
              version: distributions?.[DistributionType.winArm64ZipAF]?.version,
            },
            {
              type: 'winArm64ZipGR',
              label: 'Zip 免安装 ARM64 (GitHub Release)',
              href: distributions?.[DistributionType.winArm64ZipGR]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64ZipGR],
              version: distributions?.[DistributionType.winArm64ZipGR]?.version,
            },
            {
              type: 'winArm64ZipHFM',
              label: 'Zip 免安装 ARM64 (HF-Mirror)',
              href: distributions?.[DistributionType.winArm64ZipHFM]?.url || '#',
              available: !!distributions?.[DistributionType.winArm64ZipHFM],
              version: distributions?.[DistributionType.winArm64ZipHFM]?.version,
            },
          ],
        };
      case 'macos':
        return {
          platformName: t.macos,
          platformIcon: getAppleLogoPath({ theme }),
          downloads: [
            {
              type: 'macosHF',
              label: 'HuggingFace',
              href: distributions?.[DistributionType.macosHF]?.url || '#',
              available: !!distributions?.[DistributionType.macosHF],
              version: distributions?.[DistributionType.macosHF]?.version,
            },
            {
              type: 'macosAF',
              label: 'Aifasthub',
              href: distributions?.[DistributionType.macosAF]?.url || '#',
              available: !!distributions?.[DistributionType.macosAF],
              version: distributions?.[DistributionType.macosAF]?.version,
            },
            {
              type: 'macosGR',
              label: 'GitHub Release',
              href: distributions?.[DistributionType.macosGR]?.url || '#',
              available: !!distributions?.[DistributionType.macosGR],
              version: distributions?.[DistributionType.macosGR]?.version,
            },
            {
              type: 'macosHFM',
              label: 'HF-Mirror',
              href: distributions?.[DistributionType.macosHFM]?.url || '#',
              available: !!distributions?.[DistributionType.macosHFM],
              version: distributions?.[DistributionType.macosHFM]?.version,
            },
          ],
        };
      case 'linux':
        return {
          platformName: t.linux,
          platformIcon: getPlatformIconPath({ platform: 'linux' }),
          downloads: [
            {
              type: 'linuxHF',
              label: 'tar.gz (HuggingFace)',
              href: distributions?.[DistributionType.linuxHF]?.url || '#',
              available: !!distributions?.[DistributionType.linuxHF],
              version: distributions?.[DistributionType.linuxHF]?.version,
            },
            {
              type: 'linuxAF',
              label: 'tar.gz (Aifasthub)',
              href: distributions?.[DistributionType.linuxAF]?.url || '#',
              available: !!distributions?.[DistributionType.linuxAF],
              version: distributions?.[DistributionType.linuxAF]?.version,
            },
            {
              type: 'linuxGR',
              label: 'tar.gz (GitHub Release)',
              href: distributions?.[DistributionType.linuxGR]?.url || '#',
              available: !!distributions?.[DistributionType.linuxGR],
              version: distributions?.[DistributionType.linuxGR]?.version,
            },
            {
              type: 'linuxHFM',
              label: 'tar.gz (HF-Mirror)',
              href: distributions?.[DistributionType.linuxHFM]?.url || '#',
              available: !!distributions?.[DistributionType.linuxHFM],
              version: distributions?.[DistributionType.linuxHFM]?.version,
            },
          ],
        };
      default:
        return null;
    }
  };

  const smartDownloadOptions = getSmartDownloadOptions();
  const isChineseLocale = locale === 'zh-CN' || locale === 'zh-TW';
  const shouldHideWindowsX64Destinations = platform === 'windows' && cpuArchitecture === 'arm64';

  const sortDownloadsForChinese = <T extends { type: string }>(downloads: T[]): T[] => {
    if (!isChineseLocale) {
      return downloads;
    }

    const getSortPriority = (type: string): number => {
      if (type.includes('AF')) return 1;
      if (type.includes('HFM')) return 2;
      if (type.includes('HF') && !type.includes('HFM')) return 3;
      if (type.includes('GR')) return 4;
      return 5;
    };

    return [...downloads].sort((a, b) => getSortPriority(a.type) - getSortPriority(b.type));
  };

  const filterWindowsDownloadsForCurrentDevice = <T extends { type: string }>(downloads: T[]): T[] => {
    if (!shouldHideWindowsX64Destinations) {
      return downloads;
    }

    return downloads.filter((download) => download.type.toLowerCase().includes('arm64'));
  };

  const scrollToSmartDownload = () => {
    smartDownloadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToAllPlatforms = () => {
    allPlatformsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const platforms: Record<'mobile' | 'desktop', PlatformOption[]> = {
    mobile: [
      {
        name: t.android,
        icon: '/images/platforms/android.svg',
        minOs: t.androidRequirement,
        downloads: [
          {
            type: 'androidHF',
            label: 'HuggingFace',
            href: distributions?.[DistributionType.androidHF]?.url || '#',
            available: !!distributions?.[DistributionType.androidHF],
            version: distributions?.[DistributionType.androidHF]?.version,
          },
          {
            type: 'androidAF',
            label: 'Aifasthub',
            href: distributions?.[DistributionType.androidAF]?.url || '#',
            available: !!distributions?.[DistributionType.androidAF],
            version: distributions?.[DistributionType.androidAF]?.version,
          },
          {
            type: 'androidGR',
            label: 'GitHub Release',
            href: distributions?.[DistributionType.androidGR]?.url || '#',
            available: !!distributions?.[DistributionType.androidGR],
            version: distributions?.[DistributionType.androidGR]?.version,
          },
          {
            type: 'androidHFM',
            label: 'HF-Mirror',
            href: distributions?.[DistributionType.androidHFM]?.url || '#',
            available: !!distributions?.[DistributionType.androidHFM],
            version: distributions?.[DistributionType.androidHFM]?.version,
          },
          {
            type: 'androidPgyer',
            label: 'Pgyer',
            href: distributions?.[DistributionType.androidPgyer]?.url || '#',
            available: !!distributions?.[DistributionType.androidPgyer],
            version: distributions?.[DistributionType.androidPgyer]?.version,
          },
          {
            type: 'androidGooglePlay',
            label: t.playStore,
            href:
              distributions?.[DistributionType.androidGooglePlay]?.url ||
              'https://play.google.com/store/apps/details?id=com.rwkvzone.chat',
            badge: googlePlayBadgePath,
            available: !!distributions?.[DistributionType.androidGooglePlay],
            version: distributions?.[DistributionType.androidGooglePlay]?.version,
          },
        ],
      },
      {
        name: t.ios,
        icon: appleLogoPath,
        minOs: t.iosRequirement,
        downloads: [
          {
            type: 'iOSTF',
            label: t.testFlight,
            href:
              distributions?.[DistributionType.iOSTF]?.url ||
              'https://testflight.apple.com/join/DaMqCNKh',
            available: true,
            version: distributions?.[DistributionType.iOSTF]?.version,
          },
          {
            type: 'iOSAS',
            label: t.appStore,
            href:
              distributions?.[DistributionType.iOSAS]?.url ||
              'https://apps.apple.com/app/rwkv-chat/id6740192639',
            badge: appStoreBadgePath,
            available: !!distributions?.[DistributionType.iOSAS],
            version: distributions?.[DistributionType.iOSAS]?.version,
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
            type: 'macosHF',
            label: 'HuggingFace',
            href: distributions?.[DistributionType.macosHF]?.url || '#',
            available: !!distributions?.[DistributionType.macosHF],
            version: distributions?.[DistributionType.macosHF]?.version,
          },
          {
            type: 'macosAF',
            label: 'Aifasthub',
            href: distributions?.[DistributionType.macosAF]?.url || '#',
            available: !!distributions?.[DistributionType.macosAF],
            version: distributions?.[DistributionType.macosAF]?.version,
          },
          {
            type: 'macosGR',
            label: 'GitHub Release',
            href: distributions?.[DistributionType.macosGR]?.url || '#',
            available: !!distributions?.[DistributionType.macosGR],
            version: distributions?.[DistributionType.macosGR]?.version,
          },
          {
            type: 'macosHFM',
            label: 'HF-Mirror',
            href: distributions?.[DistributionType.macosHFM]?.url || '#',
            available: !!distributions?.[DistributionType.macosHFM],
            version: distributions?.[DistributionType.macosHFM]?.version,
          },
        ],
      },
      {
        name: t.windows,
        icon: '/images/platforms/windows-logo.png',
        minOs: t.windowsRequirement,
        downloads: [
          {
            type: 'winHF',
            label: 'Installer (HuggingFace)',
            href: distributions?.[DistributionType.winHF]?.url || '#',
            available: !!distributions?.[DistributionType.winHF],
            version: distributions?.[DistributionType.winHF]?.version,
          },
          {
            type: 'winAF',
            label: 'Installer (Aifasthub)',
            href: distributions?.[DistributionType.winAF]?.url || '#',
            available: !!distributions?.[DistributionType.winAF],
            version: distributions?.[DistributionType.winAF]?.version,
          },
          {
            type: 'winGR',
            label: 'Installer (GitHub Release)',
            href: distributions?.[DistributionType.winGR]?.url || '#',
            available: !!distributions?.[DistributionType.winGR],
            version: distributions?.[DistributionType.winGR]?.version,
          },
          {
            type: 'winHFM',
            label: 'Installer (HF-Mirror)',
            href: distributions?.[DistributionType.winHFM]?.url || '#',
            available: !!distributions?.[DistributionType.winHFM],
            version: distributions?.[DistributionType.winHFM]?.version,
          },
          {
            type: 'winZipHF',
            label: 'Zip 免安装 (HuggingFace)',
            href: distributions?.[DistributionType.winZipHF]?.url || '#',
            available: !!distributions?.[DistributionType.winZipHF],
            version: distributions?.[DistributionType.winZipHF]?.version,
          },
          {
            type: 'winZipAF',
            label: 'Zip 免安装 (Aifasthub)',
            href: distributions?.[DistributionType.winZipAF]?.url || '#',
            available: !!distributions?.[DistributionType.winZipAF],
            version: distributions?.[DistributionType.winZipAF]?.version,
          },
          {
            type: 'winZipGR',
            label: 'Zip 免安装 (GitHub Release)',
            href: distributions?.[DistributionType.winZipGR]?.url || '#',
            available: !!distributions?.[DistributionType.winZipGR],
            version: distributions?.[DistributionType.winZipGR]?.version,
          },
          {
            type: 'winZipHFM',
            label: 'Zip 免安装 (HF-Mirror)',
            href: distributions?.[DistributionType.winZipHFM]?.url || '#',
            available: !!distributions?.[DistributionType.winZipHFM],
            version: distributions?.[DistributionType.winZipHFM]?.version,
          },
        ],
        x64Downloads: [
          {
            type: 'winHF',
            label: 'Installer (HuggingFace)',
            href: distributions?.[DistributionType.winHF]?.url || '#',
            available: !!distributions?.[DistributionType.winHF],
            version: distributions?.[DistributionType.winHF]?.version,
          },
          {
            type: 'winAF',
            label: 'Installer (Aifasthub)',
            href: distributions?.[DistributionType.winAF]?.url || '#',
            available: !!distributions?.[DistributionType.winAF],
            version: distributions?.[DistributionType.winAF]?.version,
          },
          {
            type: 'winGR',
            label: 'Installer (GitHub Release)',
            href: distributions?.[DistributionType.winGR]?.url || '#',
            available: !!distributions?.[DistributionType.winGR],
            version: distributions?.[DistributionType.winGR]?.version,
          },
          {
            type: 'winHFM',
            label: 'Installer (HF-Mirror)',
            href: distributions?.[DistributionType.winHFM]?.url || '#',
            available: !!distributions?.[DistributionType.winHFM],
            version: distributions?.[DistributionType.winHFM]?.version,
          },
          {
            type: 'winZipHF',
            label: 'Zip 免安装 (HuggingFace)',
            href: distributions?.[DistributionType.winZipHF]?.url || '#',
            available: !!distributions?.[DistributionType.winZipHF],
            version: distributions?.[DistributionType.winZipHF]?.version,
          },
          {
            type: 'winZipAF',
            label: 'Zip 免安装 (Aifasthub)',
            href: distributions?.[DistributionType.winZipAF]?.url || '#',
            available: !!distributions?.[DistributionType.winZipAF],
            version: distributions?.[DistributionType.winZipAF]?.version,
          },
          {
            type: 'winZipGR',
            label: 'Zip 免安装 (GitHub Release)',
            href: distributions?.[DistributionType.winZipGR]?.url || '#',
            available: !!distributions?.[DistributionType.winZipGR],
            version: distributions?.[DistributionType.winZipGR]?.version,
          },
          {
            type: 'winZipHFM',
            label: 'Zip 免安装 (HF-Mirror)',
            href: distributions?.[DistributionType.winZipHFM]?.url || '#',
            available: !!distributions?.[DistributionType.winZipHFM],
            version: distributions?.[DistributionType.winZipHFM]?.version,
          },
        ],
        arm64Downloads: [
          {
            type: 'winArm64HF',
            label: 'Installer (HuggingFace)',
            href: distributions?.[DistributionType.winArm64HF]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64HF],
            version: distributions?.[DistributionType.winArm64HF]?.version,
          },
          {
            type: 'winArm64AF',
            label: 'Installer (Aifasthub)',
            href: distributions?.[DistributionType.winArm64AF]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64AF],
            version: distributions?.[DistributionType.winArm64AF]?.version,
          },
          {
            type: 'winArm64GR',
            label: 'Installer (GitHub Release)',
            href: distributions?.[DistributionType.winArm64GR]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64GR],
            version: distributions?.[DistributionType.winArm64GR]?.version,
          },
          {
            type: 'winArm64HFM',
            label: 'Installer (HF-Mirror)',
            href: distributions?.[DistributionType.winArm64HFM]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64HFM],
            version: distributions?.[DistributionType.winArm64HFM]?.version,
          },
          {
            type: 'winArm64ZipHF',
            label: 'Zip 免安装 (HuggingFace)',
            href: distributions?.[DistributionType.winArm64ZipHF]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64ZipHF],
            version: distributions?.[DistributionType.winArm64ZipHF]?.version,
          },
          {
            type: 'winArm64ZipAF',
            label: 'Zip 免安装 (Aifasthub)',
            href: distributions?.[DistributionType.winArm64ZipAF]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64ZipAF],
            version: distributions?.[DistributionType.winArm64ZipAF]?.version,
          },
          {
            type: 'winArm64ZipGR',
            label: 'Zip 免安装 (GitHub Release)',
            href: distributions?.[DistributionType.winArm64ZipGR]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64ZipGR],
            version: distributions?.[DistributionType.winArm64ZipGR]?.version,
          },
          {
            type: 'winArm64ZipHFM',
            label: 'Zip 免安装 (HF-Mirror)',
            href: distributions?.[DistributionType.winArm64ZipHFM]?.url || '#',
            available: !!distributions?.[DistributionType.winArm64ZipHFM],
            version: distributions?.[DistributionType.winArm64ZipHFM]?.version,
          },
        ],
      },
      {
        name: t.linux,
        icon: '/images/platforms/linux.png',
        minOs: t.linuxRequirement,
        downloads: [
          {
            type: 'linuxHF',
            label: 'tar.gz (HuggingFace)',
            href: distributions?.[DistributionType.linuxHF]?.url || '#',
            available: !!distributions?.[DistributionType.linuxHF],
            version: distributions?.[DistributionType.linuxHF]?.version,
          },
          {
            type: 'linuxAF',
            label: 'tar.gz (Aifasthub)',
            href: distributions?.[DistributionType.linuxAF]?.url || '#',
            available: !!distributions?.[DistributionType.linuxAF],
            version: distributions?.[DistributionType.linuxAF]?.version,
          },
          {
            type: 'linuxGR',
            label: 'tar.gz (GitHub Release)',
            href: distributions?.[DistributionType.linuxGR]?.url || '#',
            available: !!distributions?.[DistributionType.linuxGR],
            version: distributions?.[DistributionType.linuxGR]?.version,
          },
          {
            type: 'linuxHFM',
            label: 'tar.gz (HF-Mirror)',
            href: distributions?.[DistributionType.linuxHFM]?.url || '#',
            available: !!distributions?.[DistributionType.linuxHFM],
            version: distributions?.[DistributionType.linuxHFM]?.version,
          },
        ],
      },
    ],
  };

  const smartDownloads = smartDownloadOptions
    ? sortDownloadsForChinese(
        platform === 'windows'
          ? filterWindowsDownloadsForCurrentDevice(smartDownloadOptions.downloads)
          : smartDownloadOptions.downloads,
      )
    : [];

  const allPlatformOptions = [
    platforms.mobile.find((item) => item.name === t.android),
    platforms.desktop.find((item) => item.name === t.windows),
    platforms.desktop.find((item) => item.name === t.macos),
    platforms.mobile.find((item) => item.name === t.ios),
    platforms.desktop.find((item) => item.name === t.linux),
  ].filter(Boolean) as PlatformOption[];

  const renderDownloadAction = (download: DownloadOption, featured = false) => {
    const parsed = parseDownloadLabel(download.label);
    const version = getDownloadVersion(download.version);
    const meta = [parsed.architecture, parsed.source].filter(Boolean).join(' · ');
    const isAvailable = download.available !== false;
    const href = isAvailable && download.href !== '#' ? download.href : '#';
    const isExternal = href.startsWith('http');

    return (
      <a
        key={download.type}
        href={href}
        className={`${styles.downloadAction} ${featured ? styles.downloadActionFeatured : ''} ${download.badge ? styles.downloadActionBadge : ''} ${!isAvailable ? styles.downloadActionDisabled : ''}`}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={(event) => {
          if (!isAvailable || href === '#') {
            event.preventDefault();
          }
        }}
      >
        {download.badge ? (
          <div className={styles.badgeShell}>
            <Image
              src={download.badge}
              alt={download.label}
              width={155}
              height={60}
              className={styles.badgeImage}
              unoptimized
            />
            {version && <span className={styles.badgeVersion}>{version}</span>}
          </div>
        ) : (
          <>
            <div className={styles.downloadActionText}>
              <span className={styles.downloadActionTitle}>{parsed.title}</span>
              {(meta || version) && (
                <span className={styles.downloadActionMeta}>
                  {[meta, version].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            {isAvailable && (
              <svg
                className={styles.downloadArrow}
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
            )}
          </>
        )}
      </a>
    );
  };

  const renderShowcaseDownload = (download: DownloadOption) => {
    const parsed = parseDownloadLabel(download.label);
    const version = getDownloadVersion(download.version);
    const meta = [parsed.architecture, parsed.source].filter(Boolean).join(' · ');
    const isAvailable = download.available !== false;
    const href = isAvailable && download.href !== '#' ? download.href : '#';
    const isExternal = href.startsWith('http');

    return (
      <a
        key={download.type}
        href={href}
        className={`${styles.showcaseLink} ${download.badge ? styles.showcaseLinkBadge : ''} ${!isAvailable ? styles.showcaseLinkDisabled : ''}`}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={(event) => {
          if (!isAvailable || href === '#') {
            event.preventDefault();
          }
        }}
      >
        {download.badge ? (
          <div className={styles.showcaseBadgeShell}>
            <Image
              src={download.badge}
              alt={download.label}
              width={145}
              height={56}
              className={styles.showcaseBadgeImage}
              unoptimized
            />
            <div className={styles.showcaseBadgeMeta}>
              <span className={styles.showcaseItemTitle}>{download.label}</span>
              {version && <span className={styles.showcaseItemMeta}>{version}</span>}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.showcaseLinkText}>
              <span className={styles.showcaseItemTitle}>{parsed.title}</span>
              <span className={styles.showcaseItemMeta}>
                {[meta, version].filter(Boolean).join(' · ') || download.label}
              </span>
            </div>
            {isAvailable && (
              <svg
                className={styles.showcaseArrow}
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
            )}
          </>
        )}
      </a>
    );
  };

  const renderPlatformCard = (platformOption: PlatformOption) => {
    const hasArchitectures = Boolean(
      platformOption.x64Downloads && platformOption.arm64Downloads?.length,
    );

    return (
      <article
        key={platformOption.name}
        className={`${styles.platformCard} ${platformOption.name === t.windows ? styles.platformCardWide : ''}`}
      >
        <div className={styles.platformCardHeader}>
          <div className={styles.platformTitleWrap}>
            <Image
              key={`${platformOption.icon}-${theme}`}
              src={platformOption.icon}
              alt={platformOption.name}
              width={48}
              height={48}
              className={styles.platformIconImage}
            />
            <div>
              <h3 className={styles.platformName}>{platformOption.name}</h3>
              <p className={styles.platformMinOs}>{platformOption.minOs}</p>
            </div>
          </div>
        </div>

        {hasArchitectures ? (
          <div className={styles.architectureGroup}>
            {!shouldHideWindowsX64Destinations && platformOption.x64Downloads && (
              <div className={`${styles.architectureBlock} ${styles.architectureBlockX64}`}>
                <div className={`${styles.architectureLabel} ${styles.architectureLabelX64}`}>
                  x64
                </div>
                <div className={styles.downloadGrid}>
                  {sortDownloadsForChinese(platformOption.x64Downloads).map((download) =>
                    renderDownloadAction(download),
                  )}
                </div>
              </div>
            )}
            {platformOption.arm64Downloads && (
              <div className={`${styles.architectureBlock} ${styles.architectureBlockArm64}`}>
                <div className={`${styles.architectureLabel} ${styles.architectureLabelArm64}`}>
                  ARM64
                </div>
                <div className={styles.downloadGrid}>
                  {sortDownloadsForChinese(platformOption.arm64Downloads).map((download) =>
                    renderDownloadAction(download),
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.downloadGrid}>
            {sortDownloadsForChinese(platformOption.downloads).map((download) =>
              renderDownloadAction(download),
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <main className={styles.main}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <Image
              src={getAppIconPath()}
              alt={t.appName}
              width={44}
              height={44}
              className={styles.brandIcon}
              priority
            />
            <div className={styles.brandText}>
              <span className={styles.brandName}>{t.appName}</span>
              <span className={styles.brandTag}>{t.appTagline}</span>
            </div>
          </Link>

          <nav className={styles.nav}>
            <a href="#smart-download" className={styles.navLink}>
              {t.smartDownload}
            </a>
            <a href="#all-platforms" className={styles.navLink}>
              {t.downloadOtherPlatforms}
            </a>
            <a href="#features" className={styles.navLink}>
              {t.features}
            </a>
            <a href="#open-source" className={styles.navLink}>
              {t.openSource}
            </a>
          </nav>

          <div className={styles.toolbar}>
            <LanguageSwitcher />
            <ThemeSwitcher />
            <ReleaseNotesLink />
            <GitHubLink />
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroMarker}>{t.downloadNow}</div>
            <div className={styles.heroHeadline}>
              <h1 className={styles.heroTitle}>{t.appName}</h1>
              <p className={styles.heroAccent}>{t.appTagline}</p>
            </div>
            <p className={styles.heroDescription}>{t.appDescription}</p>

            <div className={styles.heroActions}>
              <button type="button" className={styles.primaryCta} onClick={scrollToSmartDownload}>
                {t.downloadNow}
              </button>
              <button type="button" className={styles.secondaryCta} onClick={scrollToAllPlatforms}>
                {t.downloadOtherPlatforms}
              </button>
            </div>

            <div className={styles.heroHighlights}>
              {features.slice(0, 3).map((feature) => (
                <div key={feature.title} className={styles.highlightChip}>
                  <span className={styles.highlightIcon}>{feature.icon}</span>
                  <span>{feature.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.heroShowcase}>
            <div className={styles.showcaseCardPrimary}>
              <div className={styles.sectionBadge}>
                {smartDownloadOptions?.platformName || t.downloadForYourDevice}
              </div>
              <div className={styles.showcaseHeader}>
                {smartDownloadOptions && (
                  <Image
                    key={`${smartDownloadOptions.platformIcon}-${theme}`}
                    src={smartDownloadOptions.platformIcon}
                    alt={smartDownloadOptions.platformName}
                    width={28}
                    height={28}
                    className={styles.showcasePlatformIcon}
                  />
                )}
                <h2 className={styles.showcaseTitle}>{t.downloadForYourDevice}</h2>
              </div>
              <div className={styles.showcaseList}>
                {smartDownloads.length > 0
                  ? smartDownloads.slice(0, 3).map((download) => renderShowcaseDownload(download))
                  : Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`showcase-loading-${index}`}
                        className={`${styles.showcaseItem} ${styles.showcaseItemLoading}`}
                        aria-hidden="true"
                      >
                        <span className={styles.showcaseLoadingTitle} />
                        <span className={styles.showcaseLoadingMeta} />
                      </div>
                    ))}
              </div>
            </div>

            <div className={styles.showcaseCardSecondary}>
              <div className={styles.sectionBadge}>{t.featureCrossplatform}</div>
              <div className={styles.platformChipRow}>
                {[t.android, t.ios, t.windows, t.macos, t.linux].map((platformName) => (
                  <span key={platformName} className={styles.platformChip}>
                    {platformName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className={styles.heroRail}>
            <div className={styles.heroRailCard}>
              <div className={styles.sectionBadge}>{t.featureCrossplatform}</div>
              <p className={styles.heroRailText}>{t.featureCrossplatformDesc}</p>
              <div className={styles.platformChipRow}>
                {[t.android, t.ios, t.windows, t.macos, t.linux].map((platformName) => (
                  <span key={`rail-${platformName}`} className={styles.platformChip}>
                    {platformName}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroRailCard}>
              <div className={styles.sectionBadge}>{t.openSource}</div>
              <p className={styles.heroRailText}>{t.openSourceDesc}</p>
              <div className={styles.heroRailLinks}>
                <Link href="/release-notes" className={styles.heroRailLink}>
                  {t.releaseNotes}
                </Link>
                <Link href="/changelog" className={styles.heroRailLink}>
                  {t.viewChangelog}
                </Link>
              </div>
            </div>
          </aside>
        </section>

        {mounted && smartDownloadOptions && (
          <section id="smart-download" ref={smartDownloadRef} className={styles.featuredSection}>
            <div className={styles.sectionIntro}>
              <div className={styles.sectionBadge}>{smartDownloadOptions.platformName}</div>
              <h2 className={styles.sectionTitle}>{t.smartDownload}</h2>
              <p className={styles.sectionDescription}>{t.downloadForYourDevice}</p>
              {isChineseLocale && t.chinaDownloadRecommendation && (
                <p className={styles.recommendationNote}>{t.chinaDownloadRecommendation}</p>
              )}
            </div>
            <div className={styles.downloadGrid}>
              {smartDownloads.map((download) => renderDownloadAction(download, true))}
            </div>
          </section>
        )}

        <section id="features" className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionIndex}>02</div>
              <h2 className={styles.sectionTitle}>{t.features}</h2>
            </div>
          </div>

          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="all-platforms" ref={allPlatformsRef} className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionIndex}>03</div>
              <h2 className={styles.sectionTitle}>{t.downloadOtherPlatforms}</h2>
            </div>
          </div>

          <div className={styles.platformCollectionGrid}>
            {allPlatformOptions.map((platformOption) => renderPlatformCard(platformOption))}
          </div>
        </section>

        <section id="open-source" className={styles.openSourceSection}>
          <div className={styles.openSourceContent}>
            <div>
              <div className={styles.sectionIndex}>04</div>
              <h2 className={styles.sectionTitle}>{t.openSource}</h2>
              <p className={styles.sectionDescription}>{t.openSourceDesc}</p>
            </div>

            <div className={styles.openSourceActions}>
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
              <div className={styles.inlineLinkGroup}>
                <Link href="/changelog" className={styles.inlineLinkCard}>
                  {t.viewChangelog}
                </Link>
                <Link href="/release-notes" className={styles.inlineLinkCard}>
                  {t.releaseNotes}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
