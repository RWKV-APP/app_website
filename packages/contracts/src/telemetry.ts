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
  'samsung'
] as const

export type TelemetryBuildMode = (typeof TELEMETRY_BUILD_MODE_ORDER)[number]
