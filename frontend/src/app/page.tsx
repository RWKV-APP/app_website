'use client';

import Image from 'next/image';
import { useAtom, useAtomValue } from 'jotai';
import { useRef, useState, useEffect } from 'react';
import {
  translationsAtom,
  localeAtom,
  themeAtom,
  devicePlatformAtom,
  locationAtom,
  detectLocale,
} from '@/atoms';
import { ThemeSwitcher, LanguageSwitcher, GitHubLink, ReleaseNotesLink } from '@/components';
import {
  getAppStoreBadgePath,
  getAppleLogoPath,
  getAppIconPath,
  getPlatformIconPath,
  getGooglePlayBadgePath,
  fetchLatestDistributions,
  fetchLocation,
} from '@/utils';
import { detectLocaleFromLocation, type Locale } from '@/i18n/locales';
import { LatestDistributionsResponse, DistributionType } from '@/types/distribution';
import styles from './page.module.css';

export default function Home() {
  const t = useAtomValue(translationsAtom);
  const [locale, setLocale] = useAtom(localeAtom);
  const theme = useAtomValue(themeAtom);
  const platform = useAtomValue(devicePlatformAtom);
  const [location, setLocation] = useAtom(locationAtom);
  const allPlatformsRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [distributions, setDistributions] = useState<LatestDistributionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
      fetchLatestDistributions()
        .then((data) => {
          setDistributions(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load distributions:', error);
          setLoading(false);
        });

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

  const features = [
    { icon: '📴', title: t.featureOffline, desc: t.featureOfflineDesc },
    { icon: '🔒', title: t.featurePrivacy, desc: t.featurePrivacyDesc },
    { icon: '🌐', title: t.featureCrossplatform, desc: t.featureCrossplatformDesc },
    { icon: '⚡', title: t.featureAcceleration, desc: t.featureAccelerationDesc },
    { icon: '🎨', title: t.featureMultimodal, desc: t.featureMultimodalDesc },
  ];

  // Only compute theme-dependent paths after mounting to avoid hydration mismatch
  const appleLogoPath = mounted
    ? getAppleLogoPath({ theme })
    : getAppleLogoPath({ theme: 'light' });
  const appStoreBadgePath = mounted
    ? getAppStoreBadgePath({ locale, theme })
    : getAppStoreBadgePath({ locale, theme: 'light' });

  const googlePlayBadgePath = getGooglePlayBadgePath({ locale });

  // 根据设备平台获取对应的下载选项
  const getSmartDownloadOptions = () => {
    if (!mounted || !distributions) {
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
              available: true, // TestFlight link is always available
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

  // 判断是否为中文语言
  const isChineseLocale = locale === 'zh-CN' || locale === 'zh-TW';

  // 对下载选项进行排序（中文时将 AI FastLab 和 HF Mirror 提前）
  const sortDownloadsForChinese = <T extends { type: string }>(downloads: T[]): T[] => {
    if (!isChineseLocale) {
      return downloads;
    }

    // 创建排序函数
    const getSortPriority = (type: string): number => {
      // AF (Aifasthub) 和 HFM (HF-Mirror) 优先级最高
      if (type.includes('AF')) return 1;
      if (type.includes('HFM')) return 2;
      // HF (HuggingFace) 和 GR (GitHub Release) 优先级较低
      if (type.includes('HF') && !type.includes('HFM')) return 3;
      if (type.includes('GR')) return 4;
      // 其他选项保持原顺序
      return 5;
    };

    return [...downloads].sort((a, b) => {
      const priorityA = getSortPriority(a.type);
      const priorityB = getSortPriority(b.type);
      return priorityA - priorityB;
    });
  };

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
            available: true, // TestFlight link is always available
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

  return (
    <main className={styles.main}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <LanguageSwitcher />
        <ThemeSwitcher />
        <ReleaseNotesLink />
        <GitHubLink />
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
                  key={`${smartDownloadOptions.platformIcon}-${theme}`}
                  src={smartDownloadOptions.platformIcon}
                  alt={smartDownloadOptions.platformName}
                  width={32}
                  height={32}
                  className={styles.smartDownloadPlatformIcon}
                />
                <h2 className={styles.smartDownloadTitle}>{t.smartDownload}</h2>
              </div>
              <p className={styles.smartDownloadDesc}>{t.downloadForYourDevice}</p>
              {isChineseLocale && t.chinaDownloadRecommendation && (
                <p className={styles.chinaDownloadRecommendation}>
                  {t.chinaDownloadRecommendation}
                </p>
              )}
              <div className={styles.smartDownloadButtons}>
                {sortDownloadsForChinese(smartDownloadOptions.downloads).map((download) => {
                  const isAvailable = download.available !== false;
                  const version = download.version;
                  // Display version if it exists and is not empty, even if it's "latest"
                  const displayVersion = version && version.trim() !== '' ? version : null;
                  // For non-badge buttons, include version in label if available and not "latest"
                  const displayLabel =
                    !download.badge && version && version !== 'latest'
                      ? `${download.label} (${version})`
                      : download.label;
                  return (
                    <div key={download.type} className={download.badge ? styles.badgeWrapper : ''}>
                      <a
                        href={isAvailable && download.href !== '#' ? download.href : '#'}
                        className={`${styles.downloadButton} ${download.badge ? styles.badgeButton : ''} ${!isAvailable ? styles.disabled : ''}`}
                        target={
                          isAvailable && download.href.startsWith('http') ? '_blank' : undefined
                        }
                        rel={
                          isAvailable && download.href.startsWith('http')
                            ? 'noopener noreferrer'
                            : undefined
                        }
                        onClick={(e) => {
                          if (!isAvailable || download.href === '#') {
                            e.preventDefault();
                          }
                        }}
                        style={!isAvailable ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
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
                            <span>{displayLabel}</span>
                            {isAvailable && (
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
                            )}
                          </>
                        )}
                      </a>
                      {download.badge && displayVersion && (
                        <div className={styles.badgeVersion}>{displayVersion}</div>
                      )}
                    </div>
                  );
                })}
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
                      <div className={styles.platformLabel}>
                        <Image
                          key={`${platform.icon}-${theme}`}
                          src={platform.icon}
                          alt={platform.name}
                          width={16}
                          height={16}
                          className={styles.platformIcon}
                        />
                        <span>
                          {platform.name}
                          {platform.minOs && (
                            <span className={styles.platformMinOs}> · {platform.minOs}</span>
                          )}
                        </span>
                      </div>
                      <div className={styles.platformGroupButtons}>
                        {sortDownloadsForChinese(platform.downloads).map((download) => {
                          const isAvailable = (download as any).available !== false;
                          const version = (download as any).version;
                          const displayLabel =
                            version && version !== 'latest'
                              ? `${download.label} (${version})`
                              : download.label;
                          // Display version if it exists and is not empty, even if it's "latest"
                          const displayVersion = version && version.trim() !== '' ? version : null;

                          return (
                            <div
                              key={download.type}
                              className={download.badge ? styles.badgeWrapper : ''}
                            >
                              <a
                                href={isAvailable && download.href !== '#' ? download.href : '#'}
                                className={`${styles.downloadButton} ${download.badge ? styles.badgeButton : ''} ${!isAvailable ? styles.disabled : ''}`}
                                target={
                                  isAvailable && download.href.startsWith('http')
                                    ? '_blank'
                                    : undefined
                                }
                                rel={
                                  isAvailable && download.href.startsWith('http')
                                    ? 'noopener noreferrer'
                                    : undefined
                                }
                                onClick={(e) => {
                                  if (!isAvailable || download.href === '#') {
                                    e.preventDefault();
                                  }
                                }}
                                style={
                                  !isAvailable ? { opacity: 0.5, cursor: 'not-allowed' } : undefined
                                }
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
                                    <span>{displayLabel}</span>
                                    {isAvailable && (
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
                                    )}
                                  </>
                                )}
                              </a>
                              {download.badge && displayVersion && (
                                <div className={styles.badgeVersion}>{displayVersion}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                  {platforms.desktop.map((platform) => {
                    const platformWithSubsections = platform as any;
                    const hasSubsections =
                      platformWithSubsections.x64Downloads &&
                      platformWithSubsections.arm64Downloads;

                    return (
                      <div key={platform.name} className={styles.platformGroup}>
                        <div className={styles.platformLabel}>
                          <Image
                            key={`${platform.icon}-${theme}`}
                            src={platform.icon}
                            alt={platform.name}
                            width={16}
                            height={16}
                            className={styles.platformIcon}
                          />
                          <span>
                            {platform.name}
                            {platform.minOs && (
                              <span className={styles.platformMinOs}> · {platform.minOs}</span>
                            )}
                          </span>
                        </div>
                        {hasSubsections ? (
                          <>
                            {/* x64/x86 Subsection */}
                            <div className={styles.platformSubsection}>
                              <div className={styles.platformSubsectionTitle}>x64</div>
                              <div className={styles.platformGroupButtons}>
                                {sortDownloadsForChinese(platformWithSubsections.x64Downloads).map((download: any) => {
                                  const isAvailable = download.available !== false;
                                  const version = download.version;
                                  const displayLabel =
                                    version && version !== 'latest'
                                      ? `${download.label} (${version})`
                                      : download.label;

                                  return (
                                    <a
                                      key={download.type}
                                      href={
                                        isAvailable && download.href !== '#' ? download.href : '#'
                                      }
                                      className={`${styles.downloadButton} ${!isAvailable ? styles.disabled : ''}`}
                                      target={
                                        isAvailable && download.href.startsWith('http')
                                          ? '_blank'
                                          : undefined
                                      }
                                      rel={
                                        isAvailable && download.href.startsWith('http')
                                          ? 'noopener noreferrer'
                                          : undefined
                                      }
                                      onClick={(e) => {
                                        if (!isAvailable || download.href === '#') {
                                          e.preventDefault();
                                        }
                                      }}
                                      style={
                                        !isAvailable
                                          ? { opacity: 0.5, cursor: 'not-allowed' }
                                          : undefined
                                      }
                                    >
                                      <span>{displayLabel}</span>
                                      {isAvailable && (
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
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                            {/* ARM64 Subsection */}
                            <div className={styles.platformSubsection}>
                              <div className={styles.platformSubsectionTitle}>ARM64</div>
                              <div className={styles.platformGroupButtons}>
                                {sortDownloadsForChinese(platformWithSubsections.arm64Downloads).map((download: any) => {
                                  const isAvailable = download.available !== false;
                                  const version = download.version;
                                  const displayLabel =
                                    version && version !== 'latest'
                                      ? `${download.label} (${version})`
                                      : download.label;

                                  return (
                                    <a
                                      key={download.type}
                                      href={
                                        isAvailable && download.href !== '#' ? download.href : '#'
                                      }
                                      className={`${styles.downloadButton} ${!isAvailable ? styles.disabled : ''}`}
                                      target={
                                        isAvailable && download.href.startsWith('http')
                                          ? '_blank'
                                          : undefined
                                      }
                                      rel={
                                        isAvailable && download.href.startsWith('http')
                                          ? 'noopener noreferrer'
                                          : undefined
                                      }
                                      onClick={(e) => {
                                        if (!isAvailable || download.href === '#') {
                                          e.preventDefault();
                                        }
                                      }}
                                      style={
                                        !isAvailable
                                          ? { opacity: 0.5, cursor: 'not-allowed' }
                                          : undefined
                                      }
                                    >
                                      <span>{displayLabel}</span>
                                      {isAvailable && (
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
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className={styles.platformGroupButtons}>
                            {sortDownloadsForChinese(platform.downloads).map((download) => {
                              const isAvailable = (download as any).available !== false;
                              const version = (download as any).version;
                              const displayLabel =
                                version && version !== 'latest'
                                  ? `${download.label} (${version})`
                                  : download.label;

                              return (
                                <a
                                  key={download.type}
                                  href={isAvailable && download.href !== '#' ? download.href : '#'}
                                  className={`${styles.downloadButton} ${!isAvailable ? styles.disabled : ''}`}
                                  target={
                                    isAvailable && download.href.startsWith('http')
                                      ? '_blank'
                                      : undefined
                                  }
                                  rel={
                                    isAvailable && download.href.startsWith('http')
                                      ? 'noopener noreferrer'
                                      : undefined
                                  }
                                  onClick={(e) => {
                                    if (!isAvailable || download.href === '#') {
                                      e.preventDefault();
                                    }
                                  }}
                                  style={
                                    !isAvailable
                                      ? { opacity: 0.5, cursor: 'not-allowed' }
                                      : undefined
                                  }
                                >
                                  <span>{displayLabel}</span>
                                  {isAvailable && (
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
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
      </div>
    </main>
  );
}
