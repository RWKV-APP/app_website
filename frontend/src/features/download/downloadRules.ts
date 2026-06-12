import {
  DistributionRecord,
  DistributionType,
  LatestDistributionsResponse,
} from '@/types/distribution';

export type Platform = 'android' | 'ios' | 'windows' | 'macos' | 'linux';
export type WinArch = 'x64' | 'arm64';
export type WinFormat = 'installer' | 'zip';
export type LinuxFormat = 'appimage' | 'tarGz';
export type DownloadSource =
  | 'HF'
  | 'AF'
  | 'GR'
  | 'HFM'
  | 'Pgyer'
  | 'TestFlight'
  | 'AppStore'
  | 'GooglePlay';

export interface SourceOption {
  key: DownloadSource;
  label: string;
  desc: string;
  recommended?: boolean;
}

export const LINUX_SOURCE_KEYS: DownloadSource[] = ['HF', 'AF', 'GR', 'HFM'];

export const LINUX_DISTRIBUTION_TYPES: Record<
  LinuxFormat,
  Partial<Record<DownloadSource, DistributionType>>
> = {
  appimage: {
    HF: DistributionType.linuxAppImageHF,
    AF: DistributionType.linuxAppImageAF,
    GR: DistributionType.linuxAppImageGR,
    HFM: DistributionType.linuxAppImageHFM,
  },
  tarGz: {
    HF: DistributionType.linuxHF,
    AF: DistributionType.linuxAF,
    GR: DistributionType.linuxGR,
    HFM: DistributionType.linuxHFM,
  },
};

export const TESTFLIGHT_FALLBACK_URL = 'https://testflight.apple.com/join/DaMqCNKh';
export const APP_STORE_FALLBACK_URL = 'https://apps.apple.com/app/rwkv-chat/id6740192639';
export const GOOGLE_PLAY_FALLBACK_URL =
  'https://play.google.com/store/apps/details?id=com.rwkvzone.chat';

const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function shouldPreferChinaDownloadSources(
  location: { isMainlandChina?: boolean } | null,
): boolean {
  return location?.isMainlandChina ?? false;
}

export function isOfficialStoreSource(source: DownloadSource): boolean {
  return source === 'AppStore' || source === 'GooglePlay';
}

export function getDisplaySemanticVersion(version: string | null | undefined): string | null {
  if (!version) {
    return null;
  }

  const normalizedVersion = version.trim().replace(/^v/i, '');
  if (!normalizedVersion || normalizedVersion === 'latest') {
    return null;
  }

  if (!SEMANTIC_VERSION_PATTERN.test(normalizedVersion)) {
    return null;
  }

  return normalizedVersion;
}

export function compareVersionStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left === 'latest') {
    return 1;
  }

  if (right === 'latest') {
    return -1;
  }

  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  const leftIsValid = leftParts.every((part) => Number.isFinite(part));
  const rightIsValid = rightParts.every((part) => Number.isFinite(part));

  if (!leftIsValid && !rightIsValid) {
    return 0;
  }

  if (!leftIsValid) {
    return -1;
  }

  if (!rightIsValid) {
    return 1;
  }

  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;

    if (leftPart < rightPart) {
      return -1;
    }
    if (leftPart > rightPart) {
      return 1;
    }
  }

  return 0;
}

export function compareDistributionRecords(
  left: DistributionRecord | null,
  right: DistributionRecord | null,
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return -1;
  }

  if (!right) {
    return 1;
  }

  const versionCompare = compareVersionStrings(left.version, right.version);
  if (versionCompare !== 0) {
    return versionCompare;
  }

  const leftBuild = left.build ?? -1;
  const rightBuild = right.build ?? -1;

  if (leftBuild < rightBuild) {
    return -1;
  }

  if (leftBuild > rightBuild) {
    return 1;
  }

  return 0;
}

export function hasLinuxFormatDownload(
  format: LinuxFormat,
  distributions: LatestDistributionsResponse | null,
): boolean {
  return LINUX_SOURCE_KEYS.some((source) => {
    const distributionType = LINUX_DISTRIBUTION_TYPES[format][source];
    return distributionType ? distributions?.[distributionType]?.url != null : false;
  });
}

export function getDefaultLinuxFormat(
  distributions: LatestDistributionsResponse | null,
): LinuxFormat {
  if (hasLinuxFormatDownload('appimage', distributions)) {
    return 'appimage';
  }

  if (hasLinuxFormatDownload('tarGz', distributions)) {
    return 'tarGz';
  }

  return 'appimage';
}
