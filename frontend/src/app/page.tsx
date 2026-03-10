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
  detectCpuArchitecture,
  type CpuArchitecture,
} from '@/atoms';
import { ThemeSwitcher, LanguageSwitcher, GitHubLink, ReleaseNotesLink } from '@/components';
import {
  getAppleLogoPath,
  getAppIconPath,
  getPlatformIconPath,
  fetchLatestDistributions,
  fetchLocation,
} from '@/utils';
import { detectLocaleFromLocation, type Locale } from '@/i18n/locales';
import { LatestDistributionsResponse, DistributionType } from '@/types/distribution';
import styles from './page.module.css';

// SVG feature icons — monoline, consistent weight
function FeatureIcon({ name }: { name: string }) {
  const style = { width: '1.375rem', height: '1.375rem', strokeWidth: 1.5, stroke: 'var(--color-primary)', fill: 'none' } as const;
  switch (name) {
    case 'offline':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'crossplatform':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'acceleration':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'multimodal':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    default:
      return null;
  }
}

// Step icons — SF Symbols style: thin, monoline, subtle
function StepIcon({ name }: { name: 'platform' | 'arch' | 'format' | 'download' }) {
  const s = { width: '1.125rem', height: '1.125rem', strokeWidth: 1.5, stroke: 'var(--color-secondary)', fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'platform':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );
    case 'arch':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      );
    case 'format':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    default:
      return null;
  }
}

type Platform = 'android' | 'ios' | 'windows' | 'macos' | 'linux';
type WinArch = 'x64' | 'arm64';
type WinFormat = 'installer' | 'zip';
type DownloadSource = 'HF' | 'AF' | 'GR' | 'HFM' | 'Pgyer' | 'TestFlight' | 'AppStore' | 'GooglePlay';

interface SourceOption {
  key: DownloadSource;
  label: string;
  desc: string;
  recommended?: boolean;
}

export default function Home() {
  const t = useAtomValue(translationsAtom);
  const [locale, setLocale] = useAtom(localeAtom);
  const theme = useAtomValue(themeAtom);
  const detectedPlatform = useAtomValue(devicePlatformAtom);
  const [location, setLocation] = useAtom(locationAtom);
  const [mounted, setMounted] = useState(false);
  const [distributions, setDistributions] = useState<LatestDistributionsResponse | null>(null);
  const [cpuArchitecture, setCpuArchitecture] = useState<CpuArchitecture>('unknown');
  const [loading, setLoading] = useState(true);
  const locationDetectedRef = useRef(false);
  const browserDefaultLocaleRef = useRef<Locale | null>(null);

  // Wizard state
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [winArch, setWinArch] = useState<WinArch | null>(null);
  const [winFormat, setWinFormat] = useState<WinFormat | null>(null);
  const [selectedSource, setSelectedSource] = useState<DownloadSource | null>(null);
  const [showMoreSources, setShowMoreSources] = useState(false);

  // Refs for scroll
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const stepWinFormatRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      browserDefaultLocaleRef.current = detectLocale();
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    fetchLatestDistributions()
      .then((data) => {
        if (!isCancelled) {
          setDistributions(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setLoading(false);
      });
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    if (!mounted) return;
    fetchLocation()
      .then((loc) => {
        if (!isCancelled && loc) {
          setLocation(loc);
          if (!locationDetectedRef.current) {
            locationDetectedRef.current = true;
            const detectedFromLocation = detectLocaleFromLocation(loc);
            if (detectedFromLocation && detectedFromLocation !== browserDefaultLocaleRef.current) {
              setLocale(detectedFromLocation);
            }
          }
        }
      })
      .catch(() => {});
    return () => { isCancelled = true; };
  }, [mounted, setLocation, setLocale]);

  useEffect(() => {
    let isCancelled = false;
    if (!mounted || detectedPlatform !== 'windows') return;
    detectCpuArchitecture()
      .then((arch) => { if (!isCancelled) setCpuArchitecture(arch); })
      .catch(() => { if (!isCancelled) setCpuArchitecture('unknown'); });
    return () => { isCancelled = true; };
  }, [mounted, detectedPlatform]);

  // Auto-select detected platform
  useEffect(() => {
    if (mounted && detectedPlatform && !selectedPlatform) {
      setSelectedPlatform(detectedPlatform as Platform);
    }
  }, [mounted, detectedPlatform, selectedPlatform]);

  // Auto-select win arch from detection
  useEffect(() => {
    if (selectedPlatform === 'windows' && cpuArchitecture !== 'unknown' && !winArch) {
      setWinArch(cpuArchitecture === 'arm64' ? 'arm64' : 'x64');
    }
  }, [selectedPlatform, cpuArchitecture, winArch]);

  const isChineseLocale = locale === 'zh-CN' || locale === 'zh-TW';

  // Determine which steps to show (defined early for use in useEffect below)
  const showWinArchStep = selectedPlatform === 'windows';
  const showWinFormatStep = selectedPlatform === 'windows' && winArch !== null;
  const showSourceStep =
    selectedPlatform !== null &&
    (selectedPlatform !== 'windows' || (winArch !== null && winFormat !== null));

  const features = [
    { icon: 'offline', title: t.featureOffline, desc: t.featureOfflineDesc },
    { icon: 'privacy', title: t.featurePrivacy, desc: t.featurePrivacyDesc },
    { icon: 'crossplatform', title: t.featureCrossplatform, desc: t.featureCrossplatformDesc },
    { icon: 'acceleration', title: t.featureAcceleration, desc: t.featureAccelerationDesc },
    { icon: 'multimodal', title: t.featureMultimodal, desc: t.featureMultimodalDesc },
  ];

  const appleLogoPath = mounted ? getAppleLogoPath({ theme }) : getAppleLogoPath({ theme: 'light' });

  // Scroll helper
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Platform selection handler
  const handlePlatformSelect = (p: Platform) => {
    setSelectedPlatform(p);
    setWinArch(null);
    setWinFormat(null);
    setSelectedSource(null);
    setShowMoreSources(false);

    if (p === 'windows') {
      // Auto-select arch (default to x64 if unknown)
      const arch = cpuArchitecture === 'arm64' ? 'arm64' : 'x64';
      setWinArch(arch);
      // Default to installer
      setWinFormat('installer');
      scrollTo(step2Ref);
    } else if (p === 'ios') {
      // iOS goes straight to source selection (TestFlight / App Store)
      scrollTo(step2Ref);
    } else {
      // android, macos, linux → go to source selection
      scrollTo(step2Ref);
    }
  };

  const handleWinArchSelect = (arch: WinArch) => {
    setWinArch(arch);
    setWinFormat(null);
    setSelectedSource(null);
    setShowMoreSources(false);
    scrollTo(stepWinFormatRef);
  };

  const handleWinFormatSelect = (fmt: WinFormat) => {
    setWinFormat(fmt);
    setSelectedSource(null);
    setShowMoreSources(false);
    scrollTo(step3Ref);
  };

  const handleSourceSelect = (src: DownloadSource) => {
    setSelectedSource(src);
    setShowMoreSources(false);
    scrollTo(resultRef);
  };

  // Get the recommended source based on locale/region
  const getRecommendedSource = (): DownloadSource | null => {
    if (!selectedPlatform) return null;
    if (selectedPlatform === 'ios') return 'TestFlight';
    if (isChineseLocale) return 'AF';
    return 'HF';
  };

  // Auto-select recommended source when the source step becomes visible
  useEffect(() => {
    if (!showSourceStep || selectedSource) return;
    const recommended = getRecommendedSource();
    if (recommended) {
      setSelectedSource(recommended);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSourceStep, selectedPlatform, winArch, winFormat]);

  // Get available sources for the current platform
  const getSourceOptions = (): SourceOption[] => {
    if (!selectedPlatform) return [];

    if (selectedPlatform === 'ios') {
      return [
        { key: 'TestFlight', label: 'TestFlight', desc: isChineseLocale ? '抢先体验最新版本' : 'Get early access to new versions' },
        { key: 'AppStore', label: 'App Store', desc: isChineseLocale ? '稳定正式版' : 'Stable release' },
      ];
    }

    if (selectedPlatform === 'android') {
      const sources: SourceOption[] = isChineseLocale
        ? [
            { key: 'AF', label: 'AI FastLab', desc: '国内高速下载', recommended: true },
            { key: 'HFM', label: 'HF Mirror', desc: '国内镜像' },
            { key: 'Pgyer', label: '蒲公英', desc: '国内分发平台' },
            { key: 'HF', label: 'HuggingFace', desc: '海外源' },
            { key: 'GR', label: 'GitHub Release', desc: '海外源' },
            { key: 'GooglePlay', label: 'Google Play', desc: '应用商店' },
          ]
        : [
            { key: 'HF', label: 'HuggingFace', desc: 'Primary source', recommended: true },
            { key: 'GR', label: 'GitHub Release', desc: 'Alternative source' },
            { key: 'AF', label: 'AI FastLab', desc: 'Fast in China' },
            { key: 'HFM', label: 'HF Mirror', desc: 'Mirror for China' },
            { key: 'Pgyer', label: 'Pgyer', desc: 'Distribution platform' },
            { key: 'GooglePlay', label: 'Google Play', desc: 'App store' },
          ];
      return sources;
    }

    // macOS, Linux, Windows all share HF/AF/GR/HFM
    const sources: SourceOption[] = isChineseLocale
      ? [
          { key: 'AF', label: 'AI FastLab', desc: '国内高速下载', recommended: true },
          { key: 'HFM', label: 'HF Mirror', desc: '国内镜像' },
          { key: 'HF', label: 'HuggingFace', desc: '海外源' },
          { key: 'GR', label: 'GitHub Release', desc: '海外源' },
        ]
      : [
          { key: 'HF', label: 'HuggingFace', desc: 'Primary source', recommended: true },
          { key: 'GR', label: 'GitHub Release', desc: 'Alternative source' },
          { key: 'AF', label: 'AI FastLab', desc: 'Fast in China' },
          { key: 'HFM', label: 'HF Mirror', desc: 'Mirror for China' },
        ];
    return sources;
  };

  // Resolve the final download URL
  const getDownloadUrl = (): string | null => {
    if (!selectedPlatform || !selectedSource || !distributions) return null;

    const d = distributions;
    const sourceMap: Record<string, Record<string, DistributionType>> = {
      android: {
        HF: DistributionType.androidHF,
        AF: DistributionType.androidAF,
        GR: DistributionType.androidGR,
        HFM: DistributionType.androidHFM,
        Pgyer: DistributionType.androidPgyer,
      },
      macos: {
        HF: DistributionType.macosHF,
        AF: DistributionType.macosAF,
        GR: DistributionType.macosGR,
        HFM: DistributionType.macosHFM,
      },
      linux: {
        HF: DistributionType.linuxHF,
        AF: DistributionType.linuxAF,
        GR: DistributionType.linuxGR,
        HFM: DistributionType.linuxHFM,
      },
    };

    // iOS special cases
    if (selectedPlatform === 'ios') {
      if (selectedSource === 'TestFlight') {
        return d[DistributionType.iOSTF]?.url || 'https://testflight.apple.com/join/DaMqCNKh';
      }
      if (selectedSource === 'AppStore') {
        return d[DistributionType.iOSAS]?.url || 'https://apps.apple.com/app/rwkv-chat/id6740192639';
      }
      return null;
    }

    // Android special cases
    if (selectedPlatform === 'android') {
      if (selectedSource === 'GooglePlay') {
        return d[DistributionType.androidGooglePlay]?.url || 'https://play.google.com/store/apps/details?id=com.rwkvzone.chat';
      }
      const type = sourceMap.android[selectedSource];
      return type ? d[type]?.url || null : null;
    }

    // Windows
    if (selectedPlatform === 'windows' && winArch && winFormat) {
      const winKey = winArch === 'arm64'
        ? (winFormat === 'zip'
          ? { HF: DistributionType.winArm64ZipHF, AF: DistributionType.winArm64ZipAF, GR: DistributionType.winArm64ZipGR, HFM: DistributionType.winArm64ZipHFM }
          : { HF: DistributionType.winArm64HF, AF: DistributionType.winArm64AF, GR: DistributionType.winArm64GR, HFM: DistributionType.winArm64HFM })
        : (winFormat === 'zip'
          ? { HF: DistributionType.winZipHF, AF: DistributionType.winZipAF, GR: DistributionType.winZipGR, HFM: DistributionType.winZipHFM }
          : { HF: DistributionType.winHF, AF: DistributionType.winAF, GR: DistributionType.winGR, HFM: DistributionType.winHFM });
      const type = winKey[selectedSource as keyof typeof winKey];
      return type ? d[type]?.url || null : null;
    }

    // macOS, Linux
    if (selectedPlatform === 'macos' || selectedPlatform === 'linux') {
      const type = sourceMap[selectedPlatform]?.[selectedSource];
      return type ? d[type]?.url || null : null;
    }

    return null;
  };

  // Get version for current selection
  const getDownloadVersion = (): string | null => {
    if (!selectedPlatform || !selectedSource || !distributions) return null;
    const url = getDownloadUrl();
    if (!url) return null;

    // Find matching distribution entry
    for (const [, entry] of Object.entries(distributions)) {
      if (entry && entry.url === url && entry.version) {
        return entry.version;
      }
    }
    return null;
  };

  const downloadUrl = getDownloadUrl();
  const downloadVersion = getDownloadVersion();

  // Check if source is available
  const isSourceAvailable = (src: DownloadSource): boolean => {
    if (!distributions) return false;
    if (selectedPlatform === 'ios') {
      if (src === 'TestFlight') return true;
      if (src === 'AppStore') return !!distributions[DistributionType.iOSAS];
      return false;
    }
    if (selectedPlatform === 'android' && src === 'GooglePlay') {
      return !!distributions[DistributionType.androidGooglePlay];
    }
    // Just check if there would be a URL
    const d = distributions;
    if (selectedPlatform === 'android') {
      const map: Record<string, DistributionType> = {
        HF: DistributionType.androidHF, AF: DistributionType.androidAF,
        GR: DistributionType.androidGR, HFM: DistributionType.androidHFM,
        Pgyer: DistributionType.androidPgyer,
      };
      return !!d[map[src]]?.url;
    }
    if (selectedPlatform === 'macos') {
      const map: Record<string, DistributionType> = {
        HF: DistributionType.macosHF, AF: DistributionType.macosAF,
        GR: DistributionType.macosGR, HFM: DistributionType.macosHFM,
      };
      return !!d[map[src]]?.url;
    }
    if (selectedPlatform === 'linux') {
      const map: Record<string, DistributionType> = {
        HF: DistributionType.linuxHF, AF: DistributionType.linuxAF,
        GR: DistributionType.linuxGR, HFM: DistributionType.linuxHFM,
      };
      return !!d[map[src]]?.url;
    }
    if (selectedPlatform === 'windows' && winArch && winFormat) {
      const winKey = winArch === 'arm64'
        ? (winFormat === 'zip'
          ? { HF: DistributionType.winArm64ZipHF, AF: DistributionType.winArm64ZipAF, GR: DistributionType.winArm64ZipGR, HFM: DistributionType.winArm64ZipHFM }
          : { HF: DistributionType.winArm64HF, AF: DistributionType.winArm64AF, GR: DistributionType.winArm64GR, HFM: DistributionType.winArm64HFM })
        : (winFormat === 'zip'
          ? { HF: DistributionType.winZipHF, AF: DistributionType.winZipAF, GR: DistributionType.winZipGR, HFM: DistributionType.winZipHFM }
          : { HF: DistributionType.winHF, AF: DistributionType.winAF, GR: DistributionType.winGR, HFM: DistributionType.winHFM });
      const type = winKey[src as keyof typeof winKey];
      return type ? !!d[type]?.url : false;
    }
    return false;
  };

  // Platform display data
  const platformOptions: { key: Platform; label: string; icon: string }[] = [
    { key: 'android', label: 'Android', icon: getPlatformIconPath({ platform: 'android' }) },
    { key: 'ios', label: 'iOS', icon: appleLogoPath },
    { key: 'windows', label: 'Windows', icon: '/images/platforms/windows-logo.png' },
    { key: 'macos', label: 'macOS', icon: appleLogoPath },
    { key: 'linux', label: 'Linux', icon: '/images/platforms/linux.png' },
  ];

  const showResult = selectedSource !== null && downloadUrl !== null;


  return (
    <main className={styles.main}>
      {/* Navbar — floating frosted glass */}
      <div className={styles.navbarWrap}>
        <nav className={styles.navbar}>
          <div className={styles.navLeft}>
            <Image
              src={getAppIconPath()}
              alt={t.appName}
              width={32}
              height={32}
              className={styles.navLogo}
              priority
            />
            <span className={styles.navTitle}>{t.appName}</span>
          </div>
          <div className={styles.navRight}>
            <LanguageSwitcher />
            <ThemeSwitcher />
            <ReleaseNotesLink />
            <GitHubLink />
          </div>
        </nav>
      </div>

      <div className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            {isChineseLocale ? `${t.downloadNow} ${t.appName}` : `Download ${t.appName}`}
          </h1>
          <p className={styles.heroTagline}>{t.appTagline}</p>
        </section>

        {/* Wizard */}
        <div className={styles.wizard}>
          {/* Step 1: Choose Platform */}
          <div className={styles.wizardStep}>
            <div className={styles.stepHeader}>
              <StepIcon name="platform" />
              <h2 className={styles.stepTitle}>
                {isChineseLocale ? '选择你的平台' : 'Choose your platform'}
              </h2>
            </div>
            <div className={styles.platformGrid}>
              {platformOptions.map((p) => (
                <button
                  key={p.key}
                  className={`${styles.optionCard} ${selectedPlatform === p.key ? styles.optionCardSelected : ''}`}
                  onClick={() => handlePlatformSelect(p.key)}
                  type="button"
                >
                  <Image
                    key={`${p.icon}-${theme}`}
                    src={p.icon}
                    alt={p.label}
                    width={40}
                    height={40}
                    className={styles.optionIcon}
                  />
                  <span className={styles.optionLabel}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 (Windows only): Choose Architecture */}
          {showWinArchStep && (
            <div className={styles.wizardStep} ref={step2Ref}>
              <div className={styles.stepHeader}>
                <StepIcon name="arch" />
                <h2 className={styles.stepTitle}>
                  {isChineseLocale ? '选择处理器架构' : 'Choose architecture'}
                </h2>
              </div>
              <div className={styles.optionRow}>
                <button
                  className={`${styles.optionCard} ${styles.optionCardWide} ${winArch === 'x64' ? styles.optionCardSelected : ''}`}
                  onClick={() => handleWinArchSelect('x64')}
                  type="button"
                >
                  <span className={styles.optionLabel}>x64</span>
                  <span className={styles.optionDesc}>Intel / AMD</span>
                </button>
                <button
                  className={`${styles.optionCard} ${styles.optionCardWide} ${winArch === 'arm64' ? styles.optionCardSelected : ''}`}
                  onClick={() => handleWinArchSelect('arm64')}
                  type="button"
                >
                  <span className={styles.optionLabel}>ARM64</span>
                  <span className={styles.optionDesc}>Snapdragon / Qualcomm</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3 (Windows only): Choose Format */}
          {showWinFormatStep && (
            <div className={styles.wizardStep} ref={stepWinFormatRef}>
              <div className={styles.stepHeader}>
                <StepIcon name="format" />
                <h2 className={styles.stepTitle}>
                  {isChineseLocale ? '选择安装方式' : 'Choose install type'}
                </h2>
              </div>
              <div className={styles.optionRow}>
                <button
                  className={`${styles.optionCard} ${styles.optionCardWide} ${winFormat === 'installer' ? styles.optionCardSelected : ''}`}
                  onClick={() => handleWinFormatSelect('installer')}
                  type="button"
                >
                  <span className={styles.optionLabel}>{t.installer}</span>
                  <span className={styles.optionDesc}>{isChineseLocale ? '推荐，自动安装' : 'Recommended, auto install'}</span>
                </button>
                <button
                  className={`${styles.optionCard} ${styles.optionCardWide} ${winFormat === 'zip' ? styles.optionCardSelected : ''}`}
                  onClick={() => handleWinFormatSelect('zip')}
                  type="button"
                >
                  <span className={styles.optionLabel}>{t.zip}</span>
                  <span className={styles.optionDesc}>{isChineseLocale ? '免安装，解压即用' : 'Portable, no install needed'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Download Result + Source Selection */}
          {showSourceStep && (
            <div className={styles.wizardStep} ref={selectedPlatform === 'windows' ? step3Ref : step2Ref}>
              <div className={styles.stepHeader}>
                <StepIcon name="download" />
                <h2 className={styles.stepTitle}>
                  {isChineseLocale ? '下载' : 'Download'}
                </h2>
              </div>

              {/* Download button + current source */}
              {selectedSource && (
                <div className={styles.downloadResultBlock} ref={resultRef}>
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      className={styles.bigDownloadBtn}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className={styles.bigDownloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>{isChineseLocale ? '立即下载' : 'Download Now'}</span>
                    </a>
                  ) : (
                    <span className={`${styles.bigDownloadBtn} ${styles.bigDownloadBtnDisabled}`}>
                      <svg className={styles.bigDownloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>{loading ? (isChineseLocale ? '加载中...' : 'Loading...') : (isChineseLocale ? '暂无下载链接' : 'No download link available')}</span>
                    </span>
                  )}
                  <p className={styles.currentSourceText}>
                    {isChineseLocale ? '下载源：' : 'Source: '}
                    <strong>{getSourceOptions().find(s => s.key === selectedSource)?.label}</strong>
                    {downloadVersion && downloadVersion !== 'latest' && (
                      <span className={styles.versionInline}> &middot; v{downloadVersion}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Toggle for other sources */}
              {getSourceOptions().length > 1 && (
                <button
                  className={styles.toggleSourcesBtn}
                  onClick={() => setShowMoreSources(!showMoreSources)}
                  type="button"
                >
                  <span>{isChineseLocale ? (showMoreSources ? '收起其他下载源' : '切换其他下载源') : (showMoreSources ? 'Hide other sources' : 'Switch download source')}</span>
                  <svg
                    className={`${styles.toggleChevron} ${showMoreSources ? styles.toggleChevronOpen : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}

              {/* Expanded sources */}
              {showMoreSources && (
                <div className={styles.sourceGrid}>
                  {getSourceOptions().map((src) => {
                    const available = isSourceAvailable(src.key);
                    return (
                      <button
                        key={src.key}
                        className={`${styles.sourceCard} ${selectedSource === src.key ? styles.sourceCardSelected : ''} ${!available ? styles.sourceCardDisabled : ''}`}
                        onClick={() => available && handleSourceSelect(src.key)}
                        type="button"
                        disabled={!available}
                      >
                        <div className={styles.sourceCardTop}>
                          <span className={styles.sourceLabel}>{src.label}</span>
                          {src.recommended && (
                            <span className={styles.recommendedBadge}>
                              {isChineseLocale ? '推荐' : 'Recommended'}
                            </span>
                          )}
                        </div>
                        <span className={styles.sourceDesc}>{src.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Features Section — surface background band */}
      <section className={styles.sectionBand}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{t.features}</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIcon}><FeatureIcon name={feature.icon} /></span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source Section — default background band */}
      <section className={styles.sectionBandAlt}>
        <div className={styles.sectionInner}>
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
        </div>
      </section>
    </main>
  );
}
