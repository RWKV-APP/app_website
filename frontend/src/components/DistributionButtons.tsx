'use client';

import { DistributionType, DistributionRecord } from '@/types/distribution';
import styles from './DistributionButtons.module.css';

interface DistributionButtonsProps {
  distributions: Partial<Record<DistributionType, DistributionRecord | null>>;
}

interface DistributionButtonConfig {
  type: DistributionType;
  label: string;
  icon: string;
  description?: string;
}

const distributionConfigs: DistributionButtonConfig[] = [
  // macOS
  { type: DistributionType.macosHF, label: 'macOS (HuggingFace)', icon: '🍎' },
  { type: DistributionType.macosAF, label: 'macOS (Aifasthub)', icon: '🍎' },
  { type: DistributionType.macosGR, label: 'macOS (GitHub Release)', icon: '🍎' },
  { type: DistributionType.macosHFM, label: 'macOS (HF-Mirror)', icon: '🍎' },
  // Linux
  { type: DistributionType.linuxHF, label: 'Linux (HuggingFace)', icon: '🐧' },
  { type: DistributionType.linuxAF, label: 'Linux (Aifasthub)', icon: '🐧' },
  { type: DistributionType.linuxGR, label: 'Linux (GitHub Release)', icon: '🐧' },
  { type: DistributionType.linuxHFM, label: 'Linux (HF-Mirror)', icon: '🐧' },
  // Windows Installer
  { type: DistributionType.winHF, label: 'Windows Installer (HuggingFace)', icon: '🪟' },
  { type: DistributionType.winAF, label: 'Windows Installer (Aifasthub)', icon: '🪟' },
  { type: DistributionType.winGR, label: 'Windows Installer (GitHub Release)', icon: '🪟' },
  { type: DistributionType.winHFM, label: 'Windows Installer (HF-Mirror)', icon: '🪟' },
  // Windows Zip
  { type: DistributionType.winZipHF, label: 'Windows Zip (HuggingFace)', icon: '📦' },
  { type: DistributionType.winZipAF, label: 'Windows Zip (Aifasthub)', icon: '📦' },
  { type: DistributionType.winZipGR, label: 'Windows Zip (GitHub Release)', icon: '📦' },
  { type: DistributionType.winZipHFM, label: 'Windows Zip (HF-Mirror)', icon: '📦' },
  // iOS
  { type: DistributionType.iOSTF, label: 'iOS TestFlight', icon: '📱' },
  { type: DistributionType.iOSAS, label: 'iOS App Store', icon: '📱' },
  // Android
  { type: DistributionType.androidHF, label: 'Android APK (HuggingFace)', icon: '🤖' },
  { type: DistributionType.androidAF, label: 'Android APK (Aifasthub)', icon: '🤖' },
  { type: DistributionType.androidGR, label: 'Android APK (GitHub Release)', icon: '🤖' },
  { type: DistributionType.androidHFM, label: 'Android APK (HF-Mirror)', icon: '🤖' },
  { type: DistributionType.androidPgyer, label: 'Android (Pgyer)', icon: '🤖' },
  { type: DistributionType.androidGooglePlay, label: 'Android (Google Play)', icon: '🤖' },
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
              <span className={styles.icon}>{config.icon}</span>
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

