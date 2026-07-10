'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { localeAtom, themeAtom, devicePlatformAtom } from '@/atoms';
import { LanguageSwitcher, ThemeSwitcher } from '@/components';
import { getAppleLogoPath, getPlatformIconPath } from '@/utils';
import type { Locale } from '@/i18n';
import styles from '../page.module.css';

type Platform = 'android' | 'ios' | 'windows' | 'macos';

interface FeatureItem {
  icon: 'compose' | 'lyrics' | 'crossplatform' | 'instant';
  title: string;
  desc: string;
}

interface MusicPageCopy {
  appName: string;
  heroTitle: string;
  heroTagline: string;
  choosePlatform: string;
  downloadSectionTitle: string;
  downloadNowButton: string;
  currentPlatformLabel: string;
  featuresTitle: string;
  platformNotes: Record<Platform, string>;
  features: FeatureItem[];
}

const DOWNLOAD_LINKS: Record<Platform, string> = {
  android: 'https://www.pgyer.com/rwkv-music',
  ios: 'https://apps.apple.com/cn/app/id6739768807',
  macos: 'https://apps.apple.com/cn/app/id6739768807',
  windows: 'https://apps.microsoft.com/detail/xpdc65wjh8ws17',
};

const copyByLocale: Record<Locale, MusicPageCopy> = {
  'zh-CN': {
    appName: 'RWKV Music',
    heroTitle: '下载 RWKV Music',
    heroTagline: '把灵感更快变成旋律',
    choosePlatform: '选择你的平台',
    downloadSectionTitle: '下载安装',
    downloadNowButton: '立即下载',
    currentPlatformLabel: '当前平台',
    featuresTitle: '核心特性',
    platformNotes: {
      android: 'Android 下载页',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: '灵感即写即成',
        desc: '面向音乐创作场景设计，让你从想法出发更快进入作曲流程。',
      },
      {
        icon: 'lyrics',
        title: '围绕歌词与主题创作',
        desc: '适合从歌词、情绪、风格和片段灵感继续展开音乐表达。',
      },
      {
        icon: 'crossplatform',
        title: '多端可用',
        desc: '支持 Android、iOS、Windows 与 macOS，方便在不同设备间继续创作。',
      },
      {
        icon: 'instant',
        title: '随时记录音乐想法',
        desc: '移动端与桌面端都能快速进入创作状态，减少灵感流失。',
      },
    ],
  },
  'zh-TW': {
    appName: 'RWKV Music',
    heroTitle: '下載 RWKV Music',
    heroTagline: '把靈感更快變成旋律',
    choosePlatform: '選擇你的平台',
    downloadSectionTitle: '下載安裝',
    downloadNowButton: '立即下載',
    currentPlatformLabel: '目前平台',
    featuresTitle: '核心特性',
    platformNotes: {
      android: 'Android 下載頁',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: '靈感即寫即成',
        desc: '面向音樂創作場景設計，讓你從想法出發更快進入作曲流程。',
      },
      {
        icon: 'lyrics',
        title: '圍繞歌詞與主題創作',
        desc: '適合從歌詞、情緒、風格與片段靈感繼續展開音樂表達。',
      },
      {
        icon: 'crossplatform',
        title: '多端可用',
        desc: '支援 Android、iOS、Windows 與 macOS，方便在不同裝置間繼續創作。',
      },
      {
        icon: 'instant',
        title: '隨時記錄音樂想法',
        desc: '行動端與桌面端都能快速進入創作狀態，減少靈感流失。',
      },
    ],
  },
  ja: {
    appName: 'RWKV Music',
    heroTitle: 'RWKV Music をダウンロード',
    heroTagline: 'ひらめきを、もっと早くメロディへ',
    choosePlatform: 'プラットフォームを選択',
    downloadSectionTitle: 'ダウンロード',
    downloadNowButton: '今すぐダウンロード',
    currentPlatformLabel: '選択中のプラットフォーム',
    featuresTitle: '主な特長',
    platformNotes: {
      android: 'Android ダウンロードページ',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: 'ひらめきをすぐ形に',
        desc: '音楽制作向けの体験に寄せて、アイデアから作曲へすばやく入れます。',
      },
      {
        icon: 'lyrics',
        title: '歌詞やテーマから発想',
        desc: '歌詞、ムード、スタイル、短い断片から楽曲の方向性を広げやすくします。',
      },
      {
        icon: 'crossplatform',
        title: 'マルチプラットフォーム',
        desc: 'Android、iOS、Windows、macOS に対応し、環境をまたいで使いやすい構成です。',
      },
      {
        icon: 'instant',
        title: '思いついた瞬間に着手',
        desc: 'モバイルでもデスクトップでも、ひらめいた時にすぐ制作を始められます。',
      },
    ],
  },
  ko: {
    appName: 'RWKV Music',
    heroTitle: 'RWKV Music 다운로드',
    heroTagline: '영감을 더 빠르게 멜로디로',
    choosePlatform: '플랫폼 선택',
    downloadSectionTitle: '다운로드',
    downloadNowButton: '지금 다운로드',
    currentPlatformLabel: '현재 플랫폼',
    featuresTitle: '핵심 기능',
    platformNotes: {
      android: 'Android 다운로드 페이지',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: '영감을 바로 작곡으로',
        desc: '음악 창작 흐름에 맞춘 경험으로 아이디어에서 작업 시작까지 더 빠르게 이어집니다.',
      },
      {
        icon: 'lyrics',
        title: '가사와 테마 중심의 창작',
        desc: '가사, 분위기, 스타일, 짧은 스케치에서 음악 아이디어를 확장하기 좋습니다.',
      },
      {
        icon: 'crossplatform',
        title: '다양한 플랫폼 지원',
        desc: 'Android, iOS, Windows, macOS를 지원해 여러 기기에서 이어서 사용할 수 있습니다.',
      },
      {
        icon: 'instant',
        title: '언제든 음악 아이디어 기록',
        desc: '모바일과 데스크톱 모두 빠르게 열어 창작 흐름을 놓치지 않도록 돕습니다.',
      },
    ],
  },
  en: {
    appName: 'RWKV Music',
    heroTitle: 'Download RWKV Music',
    heroTagline: 'Turn ideas into melodies faster',
    choosePlatform: 'Choose your platform',
    downloadSectionTitle: 'Download',
    downloadNowButton: 'Download Now',
    currentPlatformLabel: 'Current platform',
    featuresTitle: 'Key Features',
    platformNotes: {
      android: 'Android download page',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: 'Start composing from an idea',
        desc: 'Built around music creation so you can move from inspiration into composition quickly.',
      },
      {
        icon: 'lyrics',
        title: 'Create from lyrics and themes',
        desc: 'A good fit for developing songs from lyrics, moods, styles, and short musical prompts.',
      },
      {
        icon: 'crossplatform',
        title: 'Available across devices',
        desc: 'Supports Android, iOS, Windows, and macOS for a consistent download experience.',
      },
      {
        icon: 'instant',
        title: 'Capture ideas anytime',
        desc: 'Jump into a music session quickly on both mobile and desktop when inspiration hits.',
      },
    ],
  },
  ru: {
    appName: 'RWKV Music',
    heroTitle: 'Скачать RWKV Music',
    heroTagline: 'Быстрее превращайте идеи в мелодии',
    choosePlatform: 'Выберите платформу',
    downloadSectionTitle: 'Скачать',
    downloadNowButton: 'Скачать сейчас',
    currentPlatformLabel: 'Текущая платформа',
    featuresTitle: 'Ключевые возможности',
    platformNotes: {
      android: 'Страница загрузки Android',
      ios: 'iOS App Store',
      macos: 'macOS App Store',
      windows: 'Microsoft Store',
    },
    features: [
      {
        icon: 'compose',
        title: 'От идеи сразу к композиции',
        desc: 'Страница ориентирована на музыкальное творчество, чтобы быстрее переходить от мысли к работе.',
      },
      {
        icon: 'lyrics',
        title: 'Развитие песни от текста и темы',
        desc: 'Удобно развивать музыкальные идеи от текста, настроения, стиля и коротких набросков.',
      },
      {
        icon: 'crossplatform',
        title: 'Поддержка нескольких платформ',
        desc: 'Доступно для Android, iOS, Windows и macOS с единым сценарием загрузки.',
      },
      {
        icon: 'instant',
        title: 'Фиксируйте музыкальные идеи в любой момент',
        desc: 'Можно быстро открыть страницу на мобильном устройстве или компьютере и сразу продолжить творческий поток.',
      },
    ],
  },
};

function FeatureIcon({ name }: { name: FeatureItem['icon'] }) {
  const style = {
    width: '1.375rem',
    height: '1.375rem',
    strokeWidth: 1.5,
    stroke: 'var(--color-accent)',
    fill: 'none',
  } as const;

  switch (name) {
    case 'compose':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'lyrics':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16" />
          <path d="M4 10h10" />
          <path d="M4 15h16" />
          <path d="M4 20h10" />
        </svg>
      );
    case 'crossplatform':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      );
    case 'instant':
      return (
        <svg viewBox="0 0 24 24" style={style} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      );
    default:
      return null;
  }
}

function StepIcon() {
  const style = {
    width: '1.125rem',
    height: '1.125rem',
    strokeWidth: 1.5,
    stroke: 'var(--color-secondary)',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg viewBox="0 0 24 24" style={style}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export default function MusicPage() {
  const [locale] = useAtom(localeAtom);
  const theme = useAtomValue(themeAtom);
  const detectedPlatform = useAtomValue(devicePlatformAtom);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('android');
  const copy = copyByLocale[locale] || copyByLocale.en;

  useEffect(() => {
    if (
      detectedPlatform === 'android' ||
      detectedPlatform === 'ios' ||
      detectedPlatform === 'windows' ||
      detectedPlatform === 'macos'
    ) {
      setSelectedPlatform(detectedPlatform);
    }
  }, [detectedPlatform]);

  const appleLogoPath = getAppleLogoPath({ theme });
  const platformOptions = useMemo(
    () => [
      {
        key: 'android' as const,
        label: 'Android',
        icon: getPlatformIconPath({ platform: 'android' }),
      },
      { key: 'ios' as const, label: 'iOS', icon: appleLogoPath },
      { key: 'windows' as const, label: 'Windows', icon: '/images/platforms/windows-logo.png' },
      { key: 'macos' as const, label: 'macOS', icon: appleLogoPath },
    ],
    [appleLogoPath],
  );

  const downloadUrl = DOWNLOAD_LINKS[selectedPlatform];

  return (
    <main className={styles.main}>
      <div className={styles.navbarWrap}>
        <nav className={styles.navbar}>
          <div className={styles.navLeft}>
            <Image
              src="/images/app-icon/rwkv-music.png"
              alt={copy.appName}
              width={32}
              height={32}
              className={styles.navLogo}
              priority
            />
            <span className={styles.navTitle}>{copy.appName}</span>
          </div>
          <div className={styles.navRight}>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </nav>
      </div>

      <div className={styles.container}>
        <section className={styles.hero}>
          <Image
            src="/images/app-icon/rwkv-music.png"
            alt={copy.appName}
            width={112}
            height={112}
            priority
            style={{ borderRadius: 28 }}
          />
          <h1 className={styles.heroTitle}>{copy.heroTitle}</h1>
          <p className={styles.heroTagline}>{copy.heroTagline}</p>
        </section>

        <div className={styles.wizard}>
          <div className={styles.wizardStep}>
            <div className={styles.stepHeader}>
              <StepIcon />
              <h2 className={styles.stepTitle}>{copy.choosePlatform}</h2>
            </div>
            <div className={styles.platformGrid}>
              {platformOptions.map((platform) => (
                <button
                  key={platform.key}
                  className={`${styles.optionCard} ${selectedPlatform === platform.key ? styles.optionCardSelected : ''}`}
                  onClick={() => setSelectedPlatform(platform.key)}
                  type="button"
                >
                  <Image
                    src={platform.icon}
                    alt={platform.label}
                    width={40}
                    height={40}
                    className={styles.optionIcon}
                  />
                  <span className={styles.optionLabel}>{platform.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.wizardStep}>
            <div className={styles.stepHeader}>
              <StepIcon />
              <h2 className={styles.stepTitle}>{copy.downloadSectionTitle}</h2>
            </div>
            <div className={styles.downloadResultBlock}>
              <a
                href={downloadUrl}
                className={styles.bigDownloadBtn}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className={styles.bigDownloadIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{copy.downloadNowButton}</span>
              </a>
              <p className={styles.currentSourceText}>
                {copy.currentPlatformLabel}
                {': '}
                <strong>
                  {platformOptions.find((item) => item.key === selectedPlatform)?.label}
                </strong>
                {' · '}
                <span>{copy.platformNotes[selectedPlatform]}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className={styles.sectionBand}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{copy.featuresTitle}</h2>
          <div className={styles.featuresGrid}>
            {copy.features.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>
                  <FeatureIcon name={feature.icon} />
                </span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
