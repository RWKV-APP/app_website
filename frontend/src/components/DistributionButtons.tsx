'use client';

import { DistributionType, DistributionRecord } from '@/types/distribution';
import styles from './DistributionButtons.module.css';

interface DistributionButtonsProps {
  distributions: Partial<Record<DistributionType, DistributionRecord | null>>;
}

interface DistributionButtonConfig {
  type: DistributionType;
  label: string;
  iconType: 'apple' | 'linux' | 'windows' | 'archive' | 'phone' | 'android';
  description?: string;
}

function PlatformIcon({ type }: { type: DistributionButtonConfig['iconType'] }) {
  const s = { width: '1.25rem', height: '1.25rem', stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'apple':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 5-4 5-8s-2.25-4-3.5-4c-1.5 0-2.5 1-3.5 1s-2-1-3.5-1C9.25 10 7 10.94 7 14s2 8 5 6.94z" /><path d="M12 2c1.5 0 3 1.5 3 3-1.5 0-3-1.5-3-3z" /></svg>;
    case 'linux':
      return <svg viewBox="0 0 24 24" style={s}><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /></svg>;
    case 'windows':
      return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /></svg>;
    case 'archive':
      return <svg viewBox="0 0 24 24" style={s}><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>;
    case 'phone':
      return <svg viewBox="0 0 24 24" style={s}><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>;
    case 'android':
      return <svg viewBox="0 0 24 24" style={s}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><line x1="9" y1="4" x2="7" y2="2" /><line x1="15" y1="4" x2="17" y2="2" /></svg>;
    default:
      return null;
  }
}

const distributionConfigs: DistributionButtonConfig[] = [
  // macOS
  { type: DistributionType.macosHF, label: 'macOS (HuggingFace)', iconType: 'apple' },
  { type: DistributionType.macosAF, label: 'macOS (Aifasthub)', iconType: 'apple' },
  { type: DistributionType.macosGR, label: 'macOS (GitHub Release)', iconType: 'apple' },
  { type: DistributionType.macosHFM, label: 'macOS (HF-Mirror)', iconType: 'apple' },
  // Linux
  { type: DistributionType.linuxHF, label: 'Linux (HuggingFace)', iconType: 'linux' },
  { type: DistributionType.linuxAF, label: 'Linux (Aifasthub)', iconType: 'linux' },
  { type: DistributionType.linuxGR, label: 'Linux (GitHub Release)', iconType: 'linux' },
  { type: DistributionType.linuxHFM, label: 'Linux (HF-Mirror)', iconType: 'linux' },
  { type: DistributionType.linuxAppImageHF, label: 'Linux AppImage (HuggingFace)', iconType: 'linux' },
  { type: DistributionType.linuxAppImageAF, label: 'Linux AppImage (Aifasthub)', iconType: 'linux' },
  { type: DistributionType.linuxAppImageGR, label: 'Linux AppImage (GitHub Release)', iconType: 'linux' },
  { type: DistributionType.linuxAppImageHFM, label: 'Linux AppImage (HF-Mirror)', iconType: 'linux' },
  // Windows Installer
  { type: DistributionType.winHF, label: 'Windows Installer (HuggingFace)', iconType: 'windows' },
  { type: DistributionType.winAF, label: 'Windows Installer (Aifasthub)', iconType: 'windows' },
  { type: DistributionType.winGR, label: 'Windows Installer (GitHub Release)', iconType: 'windows' },
  { type: DistributionType.winHFM, label: 'Windows Installer (HF-Mirror)', iconType: 'windows' },
  // Windows Zip
  { type: DistributionType.winZipHF, label: 'Windows Zip (HuggingFace)', iconType: 'archive' },
  { type: DistributionType.winZipAF, label: 'Windows Zip (Aifasthub)', iconType: 'archive' },
  { type: DistributionType.winZipGR, label: 'Windows Zip (GitHub Release)', iconType: 'archive' },
  { type: DistributionType.winZipHFM, label: 'Windows Zip (HF-Mirror)', iconType: 'archive' },
  // iOS
  { type: DistributionType.iOSTF, label: 'iOS TestFlight', iconType: 'phone' },
  { type: DistributionType.iOSAS, label: 'iOS App Store', iconType: 'phone' },
  // Android
  { type: DistributionType.androidHF, label: 'Android APK (HuggingFace)', iconType: 'android' },
  { type: DistributionType.androidAF, label: 'Android APK (Aifasthub)', iconType: 'android' },
  { type: DistributionType.androidGR, label: 'Android APK (GitHub Release)', iconType: 'android' },
  { type: DistributionType.androidHFM, label: 'Android APK (HF-Mirror)', iconType: 'android' },
  { type: DistributionType.androidPgyer, label: 'Android (Pgyer)', iconType: 'android' },
  { type: DistributionType.androidGooglePlay, label: 'Android (Google Play)', iconType: 'android' },
];

export function DistributionButtons({ distributions }: DistributionButtonsProps) {
  const handleDownload = (record: DistributionRecord) => {
    if (record.url) {
      window.open(record.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>All Distributions</h2>
      <div className={styles.grid}>
        {distributionConfigs.map((config) => {
          const record = distributions[config.type] ?? null;
          const isAvailable = record !== null && record !== undefined;
          const versionText = record
            ? record.version === 'latest'
              ? 'Available'
              : record.build
                ? `${record.version} (${record.build})`
                : record.version
            : 'Not available';

          return (
            <button
              key={config.type}
              className={`${styles.button} ${isAvailable ? styles.available : styles.unavailable}`}
              onClick={() => isAvailable && record && handleDownload(record)}
              disabled={!isAvailable}
              title={isAvailable ? `Download ${versionText}` : 'Not available'}
            >
              <span className={styles.icon}><PlatformIcon type={config.iconType} /></span>
              <div className={styles.content}>
                <div className={styles.label}>{config.label}</div>
                <div className={styles.version}>{versionText}</div>
              </div>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
