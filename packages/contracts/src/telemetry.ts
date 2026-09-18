export const TELEMETRY_BUILD_MODE_ORDER = [
  'debug',
  'profile',
  'release',
  'unknown'
] as const

export const TELEMETRY_ADMIN_FILTER_OS_ORDER = [
  'macos',
  'android',
  'ios',
  'windows',
  'linux'
] as const

export const TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER = [
  'Chat',
  'VL',
  'TTS',
  'Translate',
  'Neko'
] as const

export const TELEMETRY_ADMIN_FILTER_BRAND_ORDER = [
  'apple',
  'qualcomm',
  'google',
  'huawei',
  'nvidia',
  'amd',
  'intel',
  'mediatek',
  'samsung',
  'unisoc',
  'xiaomi'
] as const

export type TelemetryBuildMode = (typeof TELEMETRY_BUILD_MODE_ORDER)[number]

// Build flavor is a separate dimension, not a release or prerelease version.
const TELEMETRY_VERSION_BUILD_SUFFIX =
  /^(\d+\.\d+\.\d+)-(debug|profile|release)$/i

export function normalizeTelemetryAppVersion(value?: string | null): string {
  const version = typeof value === 'string' ? value : ''
  return version.match(TELEMETRY_VERSION_BUILD_SUFFIX)?.[1] ?? version
}

export function normalizeTelemetryAppDimensions(
  appVersion?: string | null,
  buildMode?: string | null
): { appVersion: string; buildMode: TelemetryBuildMode } {
  const explicit =
    typeof buildMode === 'string' ? buildMode.trim().toLowerCase() : ''
  const suffix = appVersion
    ?.match(TELEMETRY_VERSION_BUILD_SUFFIX)?.[2]
    ?.toLowerCase()
  const mode = TELEMETRY_BUILD_MODE_ORDER.find(
    (candidate) => candidate !== 'unknown' && candidate === explicit
  )
  return {
    appVersion: normalizeTelemetryAppVersion(appVersion),
    buildMode: mode ?? (suffix as TelemetryBuildMode | undefined) ?? 'unknown'
  }
}
