import { Injectable, Logger } from '@nestjs/common';
import { aos as aosDevices, isAndroidDeviceString } from '@naverpay/device-info';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  TELEMETRY_ADMIN_FILTER_BRAND_ORDER,
  TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER,
  TELEMETRY_ADMIN_FILTER_OS_ORDER,
  TELEMETRY_BUILD_MODE_ORDER,
  normalizeTelemetryAppVersion,
  normalizeTelemetryAppDimensions,
  resolveTelemetrySocName as resolveKnownSocName,
  resolveTelemetryPixelSoc,
  type TelemetryBuildMode,
} from '@app/contracts';
import { PrismaService } from '../prisma/prisma.service';

const TELEMETRY_SALT = process.env.TELEMETRY_SALT || 'rwkv-telemetry-default-salt';

// Reasonable speed bounds
const MAX_PREFILL_SPEED = 100_000;
const MAX_DECODE_SPEED = 5_000;
const ADMIN_FILTER_OS_ORDER: readonly string[] = TELEMETRY_ADMIN_FILTER_OS_ORDER;
const ADMIN_FILTER_MODEL_TAG_ORDER: readonly string[] = TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER;
const ADMIN_FILTER_BRAND_ORDER: readonly string[] = TELEMETRY_ADMIN_FILTER_BRAND_ORDER;

interface TelemetryPerfBody {
  schemaVersion: number;
  installId: string;
  device: {
    socName: string;
    socBrand: string;
    os: string;
    osVersion?: string;
    deviceModel?: string;
    cpuName?: string;
    gpuName?: string;
    totalMemoryMb?: number;
    totalVramMb?: number;
  };
  app: {
    version: string;
    build: string;
    buildMode?: string;
  };
  model: {
    name: string;
    fileName: string;
    sha256: string;
    sizeB?: number;
    quantization?: string;
    backend: string;
  };
  perf: {
    prefillSpeed: number;
    decodeSpeed: number;
    isBatch?: boolean;
    batchCount?: number;
  };
  clientTimestamp: number;
}

interface LeaderboardQuery {
  socName?: string;
  modelSha256?: string;
  backend?: string;
  os?: string;
  isBatch?: string;
  appVersion?: string;
  buildMode?: string;
  limit?: string;
}

interface RecordsQuery {
  socName: string;
  socMatch?: string;
  modelSha256: string;
  backend: string;
  isBatch?: string;
  batchCount?: string;
  os?: string;
  appVersion?: string;
  buildMode?: string;
  limit?: string;
}

interface AdminRecordsQuery {
  page?: string;
  limit?: string;
  recordId?: string;
  os?: string;
  appVersion?: string;
  buildMode?: string;
  batchCount?: string;
  modelTag?: string;
  modelSize?: string;
  socBrand?: string;
  socName?: string;
  socMatch?: string;
}

interface LeaderboardAccumulator {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  reportedSocNames: Set<string>;
  socBrand: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  deviceModelCounts: Map<string, number>;
  hardwareBrands: Set<string>;
  sampleCount: number;
  decodeValues: number[];
  prefillValues: number[];
  decodeTotal: number;
  prefillTotal: number;
  decodeMax: number | null;
  prefillMax: number | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function leaderboardGroupKey(input: {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
}): string {
  return [
    input.os,
    input.modelSha256,
    input.modelName,
    input.modelFileName,
    input.modelSizeB ?? '',
    input.quantization ?? '',
    normalizeLookupKey(input.socName),
    input.socBrand,
    input.backend,
    input.isBatch ? '1' : '0',
    input.batchCount,
  ].join('\u0001');
}

function roundSpeed(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

function pickTopDecileValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => b - a);
  // 样本少于 10 条时，这里会自然回到第 1 名，也就是当前可见的最高分。
  const index = Math.max(0, Math.ceil(sorted.length * 0.1) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? null;
}

function normalizeSocFilterKey(value: string): string {
  return normalizeLookupKey(resolveKnownSocName(value) ?? value);
}

function parseSocNameFilters(value: string | undefined, match: string | undefined): string[] {
  if (match === 'canonical' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return Array.from(new Set(parsed.map((item) => item.trim()).filter(Boolean)));
      }
    } catch {
      // Older callers still send comma-separated names.
    }
  }
  return parseFilterList(value);
}

function simplifySnapdragonXEliteCpuName(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  const match = normalized.match(/^(Snapdragon\(R\)\s+X\s*-\s*[^-]+)(?:\s*-.*)?$/i);
  return match?.[1]?.trim() ?? null;
}

function isSnapdragonXEliteLabel(value: string | null | undefined): boolean {
  const key = normalizeLookupKey(value).replace(/[\s_-]+/g, '');
  return (
    key === 'xelite' ||
    key === 'snapdragonxelite' ||
    key.startsWith('snapdragon(r)x') ||
    key.startsWith('snapdragonx')
  );
}

function deriveAdminModelTag(input: {
  modelName?: string | null;
  modelFileName?: string | null;
}): string {
  const name = `${input.modelName ?? ''} ${input.modelFileName ?? ''}`.toLowerCase();
  if (
    name.includes('-vl') ||
    name.includes('_vl') ||
    name.includes(' vl') ||
    name.includes('rwkv-vl')
  ) {
    return 'VL';
  }
  if (name.includes('tts') || name.includes('spark') || name.includes('voice')) return 'TTS';
  if (name.includes('translate') || name.includes('-trans') || name.includes('translation')) {
    return 'Translate';
  }
  if (name.includes('neko')) return 'Neko';
  return 'Chat';
}

function deriveAdminWeightLabel(input: {
  modelSizeB?: number | null;
  modelName?: string | null;
  modelFileName?: string | null;
}): string {
  if (input.modelSizeB != null && input.modelSizeB > 0) {
    return `${input.modelSizeB}B`;
  }
  const fileName = input.modelFileName ?? '';
  const match = fileName.match(/(\d+\.?\d*)B/i);
  if (match) return `${match[1]}B`;
  return (
    cleanOptionalString(input.modelName) ?? cleanOptionalString(input.modelFileName) ?? 'Unknown'
  );
}

function deriveAdminWeightSortValue(label: string): number {
  const match = label.match(/^(\d+\.?\d*)B$/i);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

function toAdminBrandKey(value: string): string {
  return value === 'snapdragon' ? 'qualcomm' : value;
}

function collectHardwareBrandKeys(input: {
  socName?: string | null;
  socBrand?: string | null;
  cpuName?: string | null;
  gpuName?: string | null;
  deviceModel?: string | null;
}): string[] {
  const brands = new Set<string>();
  const addBrand = (brand: string) => {
    const key = toAdminBrandKey(brand);
    if (key && key !== 'unknown' && ADMIN_FILTER_BRAND_ORDER.includes(key)) {
      brands.add(key);
    }
  };

  addBrand(normalizeBrand(input.socBrand));
  addBrand(inferBrandFromHardware([input.socName]));
  addBrand(inferBrandFromHardware([input.cpuName]));
  addBrand(inferBrandFromHardware([input.gpuName]));
  addBrand(inferBrandFromHardware([input.deviceModel]));
  addBrand(
    inferBrandFromHardware([input.gpuName, input.cpuName, input.socName, input.deviceModel]),
  );

  return Array.from(brands);
}

function stripOsVersion(version: string | undefined): string | null {
  if (!version) return null;
  // Remove parenthetical build info: "Android 14 (API 34)" → "Android 14"
  return version.replace(/\s*\(.*\)\s*/g, '').trim() || null;
}

interface TelemetryDeviceAlias {
  socBrand: string;
  socName?: string;
  deviceName?: string;
  cpuName?: string;
  gpuName?: string;
}

interface TelemetryDeviceInput {
  socName?: string | null;
  socBrand?: string | null;
  os?: string | null;
  osVersion?: string | null;
  deviceModel?: string | null;
  cpuName?: string | null;
  gpuName?: string | null;
  totalMemoryMb?: number | null;
  totalVramMb?: number | null;
}

interface NormalizedTelemetryDevice {
  socName: string;
  socNameKey: string;
  socBrand: string;
  os: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
}

interface TelemetryLeaderboardRow {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  prefillSpeed: number;
  decodeSpeed: number;
}

interface TelemetryRecordRow extends TelemetryLeaderboardRow {
  id: number;
  appVersion: string;
  appBuild: string;
  buildMode: string | null;
  clientTimestamp: Date;
  createdAt: Date;
}

interface NormalizedTelemetryLeaderboardRow extends TelemetryLeaderboardRow {
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  socNameKey: string;
}

interface NormalizedTelemetryRecordRow extends TelemetryRecordRow {
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  buildMode: TelemetryBuildMode;
  socNameKey: string;
  reportedSocName: string;
}

const TELEMETRY_DEVICE_ALIASES: Record<string, TelemetryDeviceAlias> = {
  'sm-s942b': {
    socBrand: 'samsung',
    socName: 'Exynos 2600',
    deviceName: 'Galaxy S26',
    cpuName: 'Exynos 2600',
  },
  '(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
  'amd radeon(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
  'radeon(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
};

function cleanOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTelemetryBuildMode(value: string | null | undefined): TelemetryBuildMode | null {
  const normalized = cleanOptionalString(value)?.toLowerCase();
  if (!normalized) return null;
  return TELEMETRY_BUILD_MODE_ORDER.find((mode) => mode === normalized) ?? null;
}

function normalizeAndroidDeviceIdentifier(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  return normalized.toUpperCase();
}

function resolveAndroidDatasetDeviceName(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  if (isAndroidDeviceString(normalized)) {
    return aosDevices[normalized];
  }

  const uppercase = normalizeAndroidDeviceIdentifier(normalized);
  if (uppercase && isAndroidDeviceString(uppercase)) {
    return aosDevices[uppercase];
  }

  return null;
}

function resolveDeviceDisplayName(
  os: string | null | undefined,
  deviceModel: string | null | undefined,
): string | null {
  const normalizedDeviceModel = cleanOptionalString(deviceModel);
  if (!normalizedDeviceModel) return null;
  const alias = TELEMETRY_DEVICE_ALIASES[normalizeLookupKey(normalizedDeviceModel)];
  if (alias?.deviceName) return alias.deviceName;
  if ((os ?? '').toLowerCase() !== 'android') return null;
  return resolveAndroidDatasetDeviceName(normalizedDeviceModel);
}

function normalizeLookupKey(value: string | null | undefined): string {
  return cleanOptionalString(value)?.toLowerCase() ?? '';
}

function parseFilterList(value: string | string[] | null | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const values: string[] = [];

  for (const rawValue of rawValues) {
    const parts = String(rawValue ?? '').split(',');
    for (const part of parts) {
      const item = cleanOptionalString(part);
      if (!item || item.toLowerCase() === 'all') continue;
      const dedupeKey = item.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      values.push(item);
    }
  }

  return values;
}

function parseBuildModeFilterList(
  value: string | string[] | null | undefined,
): TelemetryBuildMode[] {
  const seen = new Set<TelemetryBuildMode>();
  const values: TelemetryBuildMode[] = [];

  for (const item of parseFilterList(value)) {
    const mode = normalizeTelemetryBuildMode(item);
    if (!mode || seen.has(mode)) continue;
    seen.add(mode);
    values.push(mode);
  }

  return values;
}

function parseLookupFilterList(value: string | string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of parseFilterList(value)) {
    const key = normalizeLookupKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(key);
  }

  return values;
}

function parseNumberFilterList(value: string | string[] | null | undefined): number[] {
  const seen = new Set<number>();
  const values: number[] = [];

  for (const item of parseFilterList(value)) {
    const parsed = Math.max(parseInt(item, 10) || 0, 0);
    if (parsed <= 0 || seen.has(parsed)) continue;
    seen.add(parsed);
    values.push(parsed);
  }

  return values;
}

type TelemetryWhere = Record<string, string | number | boolean | { in: string[] | number[] }>;

function applyStringFilter(where: TelemetryWhere, key: string, values: string[]): void {
  if (values.length === 1) {
    where[key] = values[0];
  } else if (values.length > 1) {
    where[key] = { in: values };
  }
}

// Legacy rows may have absent modes. SQL handles those rows before
// pagination/counting; Prisma's current non-null field cannot express IS NULL.
function telemetryWhereSql(where: TelemetryWhere): Prisma.Sql {
  const explicitMode = Prisma.sql`lower(trim(coalesce("buildMode", ''), char(9) || char(10) || char(11) || char(12) || char(13) || ' '))`;
  const version = Prisma.sql`substr("appVersion", 1, instr("appVersion", '-') - 1)`;
  const suffix = Prisma.sql`lower(substr("appVersion", instr("appVersion", '-') + 1))`;
  const mode = Prisma.sql`CASE
    WHEN ${explicitMode} IN ('debug', 'profile', 'release') THEN ${explicitMode}
    WHEN ${suffix} IN ('debug', 'profile', 'release')
      AND ${version} GLOB '[0-9]*.[0-9]*.[0-9]*'
      AND ${version} NOT GLOB '*[^0-9.]*'
      AND length(${version}) - length(replace(${version}, '.', '')) = 2
    THEN ${suffix} ELSE 'unknown' END`;
  const conditions = Object.entries(where).map(([key, value]) => {
    // Keys and projection columns come only from this service's allowlists;
    // every request value remains a bound parameter.
    const column = key === 'buildMode' ? mode : Prisma.raw(`"${key}"`);
    const values = typeof value === 'object' ? value.in : [value];
    if (key === 'appVersion') {
      // Canonical releases include known historical suffixes (including -Debug);
      // a directly requested raw suffixed version retains its exact-match meaning.
      const canonicalVersions = values.filter(
        (version): version is string =>
          typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version),
      );
      if (canonicalVersions.length) {
        const suffixVersions = canonicalVersions.flatMap((version: string) =>
          ['debug', 'profile', 'release'].map((mode) => `${version}-${mode}`),
        );
        return Prisma.sql`(${column} IN (${Prisma.join(values)}) OR ${column} COLLATE NOCASE IN (${Prisma.join(suffixVersions)}))`;
      }
    }
    return value && typeof value === 'object' && 'in' in value
      ? Prisma.sql`${column} IN (${Prisma.join(value.in)})`
      : Prisma.sql`${column} = ${value}`;
  });
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

function applyNumberFilter(where: TelemetryWhere, key: string, values: number[]): void {
  if (values.length === 1) {
    where[key] = values[0];
  } else if (values.length > 1) {
    where[key] = { in: values };
  }
}

function normalizeBrand(value: string | null | undefined): string {
  const key = normalizeLookupKey(value);
  if (!key || key === 'unknown') return 'unknown';
  if (key === 'qualcomm') return 'snapdragon';
  return key;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function inferBrandFromHardware(values: Array<string | null | undefined>): string {
  const combined = values
    .map((value) => normalizeLookupKey(value))
    .filter((value) => value.length > 0)
    .join(' ');

  if (!combined) return 'unknown';
  if (
    combined.includes('snapdragon') ||
    combined.includes('qualcomm') ||
    combined.includes('x elite') ||
    combined.includes('snapdragon(r) x') ||
    /\bsm\d{4}\b/.test(combined) ||
    /\b888\b/.test(combined)
  ) {
    return 'snapdragon';
  }
  if (/\bmt\d{4}\b/.test(combined) || combined.includes('mediatek')) {
    return 'mediatek';
  }
  if (combined.includes('kirin')) {
    return 'huawei';
  }
  if (
    combined.includes('google tensor') ||
    combined.includes('tensor_soc') ||
    /\btensor\s*g\d+\b/.test(combined) ||
    /\bpixel\s*7(?:\s*pro|\s*a)?\b/.test(combined)
  ) {
    return 'google';
  }
  if (
    combined.includes('nvidia') ||
    combined.includes('rtx ') ||
    combined.includes('gtx ') ||
    combined.includes('geforce')
  ) {
    return 'nvidia';
  }
  if (combined.includes('amd') || combined.includes('radeon') || combined.includes('ryzen')) {
    return 'amd';
  }
  if (combined.includes('intel') || combined.includes(' arc')) {
    return 'intel';
  }
  if (combined.includes('apple') || /\bm[1-4]\b/.test(combined)) {
    return 'apple';
  }
  if (
    combined.includes('mediatek') ||
    combined.includes('dimensity') ||
    combined.includes('helio')
  ) {
    return 'mediatek';
  }
  if (combined.includes('samsung') || combined.includes('exynos')) {
    return 'samsung';
  }
  return 'unknown';
}

function isNonHardwareSocName(value: string | null | undefined, os: string): boolean {
  const key = normalizeLookupKey(value);
  if (!key || key === 'unknown') return true;
  if (key === os) return true;
  if (key.startsWith('windows ')) return true;
  if (key === 'windows') return true;
  if (key.startsWith('linux')) return true;
  if (key.startsWith('ubuntu')) return true;
  if (key.startsWith('macos')) return true;
  if (key === 'android') return true;
  if (key === 'ios') return true;
  if (/\b(?:orayidddriver|microsoft basic (?:display|render) driver)\b/.test(key)) return true;
  return false;
}

function isGenericSocName(value: string | null | undefined, os: string): boolean {
  const key = normalizeLookupKey(value);
  return isNonHardwareSocName(value, os) || key.endsWith('_soc') || key === 'soc';
}

function shouldPreferGpuAsSocName(backend: string | null | undefined): boolean {
  return normalizeLookupKey(backend) === 'webrwkv';
}

function findTelemetryDeviceAlias(device: {
  socName?: string | null;
  deviceModel?: string | null;
  cpuName?: string | null;
  gpuName?: string | null;
}): TelemetryDeviceAlias | null {
  const keys = [
    normalizeLookupKey(device.socName),
    normalizeLookupKey(device.deviceModel),
    normalizeLookupKey(device.cpuName),
    normalizeLookupKey(device.gpuName),
  ];

  for (const key of keys) {
    if (!key) continue;
    const alias = TELEMETRY_DEVICE_ALIASES[key];
    if (alias) return alias;
  }

  return null;
}

// Exact reported code + OEM device identity. Sources: docs/telemetry-soc-names.md.
const SOC_BY_DEVICE: Record<string, string> = {
  'mt6779:bv8900': 'MediaTek Helio P90',
  'mt6983:cph2493': 'MediaTek Dimensity 9000',
  'mt6789:22071219cg': 'MediaTek Helio G99',
  'mt6789:24117rn76o': 'MediaTek Helio G99 Ultra',
  'mt6789:shark 8': 'MediaTek Helio G99',
  'mt6789:infinix x6833b': 'MediaTek Helio G99',
  'mt6789:infinix x678b': 'MediaTek Helio G99',
  'mt6789:sm-a245f': 'MediaTek Helio G99',
  'mt6895:v2314a': 'MediaTek Dimensity 8200',
  'mt6895:pjh110': 'MediaTek Dimensity 8200',
  'mt6899:v2452a': 'MediaTek Dimensity 8400',
  'mt6899:ser-an00': 'MediaTek Dimensity 8500 Elite',
  'mt6897:cph2737': 'MediaTek Dimensity 8350',
  'mt6785:redmi note 8 pro': 'MediaTek Helio G90T',
  'mt6769:sm-a225f': 'MediaTek Helio G80',
  'mt6765:sm-a045f': 'MediaTek Helio P35',
  'mt6879:motorola edge 40 neo': 'MediaTek Dimensity 7030',
  'sm6225:cph2333': 'Snapdragon 680',
  'sm6225:cph2565': 'Snapdragon 680',
  'sm6225:cph2819': 'Snapdragon 685',
  'sm6225:2201117tg': 'Snapdragon 680',
  'sm6225:2201117ti': 'Snapdragon 680',
  'sm6225:220333qny': 'Snapdragon 680',
  'sm6225:23021raa2y': 'Snapdragon 685',
  'sm6225:hey-w09': 'Snapdragon 680',
  'sm6225:sm-a057m': 'Snapdragon 680',
  'sm6225:sm-a235f': 'Snapdragon 680',
  'sm6225:moto g play - 2024': 'Snapdragon 680',
  'sm6375:2201116sg': 'Snapdragon 695',
  'sm6375:rmo-nx1': 'Snapdragon 695',
  'sm6375:moto g34 5g': 'Snapdragon 695',
  'sm6375:moto g71 5g': 'Snapdragon 695',
  'sm8250:poco f2 pro': 'Snapdragon 865',
  'sm8250:v2199a': 'Snapdragon 870',
  'sm7635:fairphone 6': 'Snapdragon 7s Gen 3',
  'mt6985:v2241a': 'MediaTek Dimensity 9200',
  'mt6985:v2362a': 'MediaTek Dimensity 9200+',
  'mt6985:pgfm10': 'MediaTek Dimensity 9200',
  'mt6877:sm-a346e': 'MediaTek Dimensity 1080',
};

function normalizeTelemetryDevice(
  device: TelemetryDeviceInput,
  backend: string | null | undefined,
): NormalizedTelemetryDevice {
  const rawSocName = cleanOptionalString(device.socName);
  const os = normalizeLookupKey(device.os) || 'unknown';
  const alias = findTelemetryDeviceAlias(device);
  const cpuName = cleanOptionalString(device.cpuName) ?? alias?.cpuName ?? null;
  const gpuName = cleanOptionalString(device.gpuName) ?? alias?.gpuName ?? null;
  const deviceModel = cleanOptionalString(device.deviceModel);
  const normalizedBrandFromInput = normalizeBrand(device.socBrand);
  const hasGenericSocName = isGenericSocName(rawSocName, os);
  const pixelSocName =
    os === 'android' && (hasGenericSocName || normalizeLookupKey(rawSocName) === 'google tensor')
      ? resolveTelemetryPixelSoc(deviceModel)
      : null;
  // Device constraints disambiguate shared platform identifiers.
  const deviceSocName =
    os === 'android'
      ? (SOC_BY_DEVICE[
          `${normalizeLookupKey(rawSocName).replace(/^(?:mediatek|qualcomm) /, '')}:${normalizeLookupKey(deviceModel)}`
        ] ?? null)
      : null;
  const mappedSocName = pixelSocName ?? deviceSocName ?? resolveKnownSocName(rawSocName);
  const simplifiedSnapdragonXName = simplifySnapdragonXEliteCpuName(cpuName);

  let socBrand = normalizedBrandFromInput;
  if (alias && (socBrand === 'unknown' || hasGenericSocName)) {
    socBrand = alias.socBrand;
  }
  if (socBrand === 'unknown') {
    socBrand = inferBrandFromHardware([gpuName, cpuName, rawSocName, deviceModel]);
  }

  let canonicalSocName = rawSocName;
  if (simplifiedSnapdragonXName && (hasGenericSocName || isSnapdragonXEliteLabel(rawSocName))) {
    canonicalSocName = simplifiedSnapdragonXName;
  } else if (
    mappedSocName &&
    (!shouldPreferGpuAsSocName(backend) || !gpuName || os === 'android' || os === 'ios')
  ) {
    canonicalSocName = mappedSocName;
  } else if (alias?.socName && hasGenericSocName) {
    canonicalSocName = alias.socName;
  } else if (shouldPreferGpuAsSocName(backend) && gpuName) {
    canonicalSocName = gpuName;
  } else if (isGenericSocName(canonicalSocName, os)) {
    canonicalSocName = shouldPreferGpuAsSocName(backend)
      ? (gpuName ?? cpuName ?? canonicalSocName)
      : (cpuName ?? gpuName ?? canonicalSocName);
  } else if (
    !shouldPreferGpuAsSocName(backend) &&
    cpuName &&
    normalizeLookupKey(canonicalSocName) === normalizeLookupKey(gpuName)
  ) {
    canonicalSocName = cpuName;
  } else if (
    alias?.gpuName &&
    normalizeLookupKey(rawSocName) === normalizeLookupKey(alias.gpuName)
  ) {
    canonicalSocName = alias.gpuName;
  } else if (alias?.gpuName && shouldPreferGpuAsSocName(backend)) {
    canonicalSocName = alias.gpuName;
  }

  if (!canonicalSocName || isNonHardwareSocName(canonicalSocName, os)) {
    canonicalSocName = 'Unknown';
    socBrand = 'unknown';
  } else {
    canonicalSocName = resolveKnownSocName(canonicalSocName) ?? canonicalSocName;
    const inferredBrand = inferBrandFromHardware([canonicalSocName]);
    // A named integrated SoC outranks stale client branding. Desktop CPU/GPU
    // vendor combinations remain available through their separate fields.
    if (
      socBrand === 'unknown' ||
      ['snapdragon', 'mediatek', 'huawei', 'google', 'samsung', 'apple'].includes(inferredBrand)
    ) {
      socBrand = inferredBrand;
    }
  }

  const osVersion = stripOsVersion(cleanOptionalString(device.osVersion) ?? undefined);

  return {
    socName: canonicalSocName,
    socNameKey: normalizeLookupKey(canonicalSocName),
    socBrand,
    os,
    osVersion,
    deviceModel,
    cpuName,
    gpuName,
    totalMemoryMb: normalizeNullableNumber(device.totalMemoryMb),
    totalVramMb: normalizeNullableNumber(device.totalVramMb),
  };
}

function normalizeTelemetryLeaderboardRow(
  row: TelemetryLeaderboardRow,
): NormalizedTelemetryLeaderboardRow {
  const normalized = normalizeTelemetryDevice(row, row.backend);
  return {
    ...row,
    ...normalized,
  };
}

function normalizeTelemetryRecordRow(row: TelemetryRecordRow): NormalizedTelemetryRecordRow {
  const normalized = normalizeTelemetryDevice(row, row.backend);
  return {
    ...row,
    ...normalizeTelemetryAppDimensions(row.appVersion, row.buildMode),
    ...normalized,
    reportedSocName: row.socName,
  };
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  // Bounded, short-lived snapshots; concurrent identical queries share one read.
  private readonly publicCache = new Map<string, { expires: number; value: Promise<unknown> }>();

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.publicCache.get(key);
    if (hit && hit.expires > now) return hit.value as Promise<T>;
    for (const [cacheKey, entry] of this.publicCache) {
      if (entry.expires <= now) this.publicCache.delete(cacheKey);
    }
    if (this.publicCache.size >= 32) this.publicCache.delete(this.publicCache.keys().next().value);
    const entry = { expires: Infinity, value: null as Promise<T> | null };
    entry.value = Promise.resolve()
      .then(load)
      .then((result) => {
        entry.expires = Date.now() + 30_000;
        return result;
      })
      .catch((error) => {
        if (this.publicCache.get(key) === entry) this.publicCache.delete(key);
        throw error;
      });
    this.publicCache.set(key, entry);
    return entry.value;
  }

  private queryKey(kind: string, query: object): string {
    return kind + JSON.stringify(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
  }

  publicRecords(query: AdminRecordsQuery) {
    return this.cached(this.queryKey('browse', query), () => this.adminRecords(query));
  }

  publicFilters() {
    return this.cached('browse-filters', () => this.adminFilters());
  }

  constructor(private readonly prisma: PrismaService) {}

  private async findTelemetryRows<T extends Prisma.TelemetryPerfSelect>(options: {
    where?: TelemetryWhere;
    select: T;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
    skip?: number;
    take?: number;
  }): Promise<Array<Prisma.TelemetryPerfGetPayload<{ select: T }>>> {
    if (!options.where?.buildMode && !options.where?.appVersion && !options.select.buildMode) {
      return this.prisma.telemetryPerf.findMany(options);
    }
    const columns = Object.keys(options.select).filter((key) => options.select[key]);
    const projection = Prisma.join(columns.map((key) => Prisma.raw(`"${key}"`)));
    const order = options.orderBy?.length
      ? Prisma.sql`ORDER BY ${Prisma.join(
          options.orderBy.flatMap((entry) =>
            Object.entries(entry).map(([key, direction]) => Prisma.raw(`"${key}" ${direction}`)),
          ),
        )}`
      : Prisma.empty;
    const pagination =
      options.take !== undefined
        ? Prisma.sql`LIMIT ${options.take} OFFSET ${options.skip ?? 0}`
        : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT ${projection} FROM "TelemetryPerf"
      ${telemetryWhereSql(options.where ?? {})} ${order} ${pagination}
    `);
    // Raw SQLite reads preserve null legacy fields, unlike the generated model.
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value == null
            ? value
            : key === 'isBatch'
              ? Boolean(value)
              : typeof value === 'bigint'
                ? Number(value)
                : value,
        ]),
      ),
    ) as Array<Prisma.TelemetryPerfGetPayload<{ select: T }>>;
  }

  private async countTelemetryRows(where: TelemetryWhere): Promise<number> {
    if (!where.buildMode && !where.appVersion) return this.prisma.telemetryPerf.count({ where });
    const [row] = await this.prisma.$queryRaw<Array<{ total: number | bigint }>>(Prisma.sql`
      SELECT count(*) AS total FROM "TelemetryPerf" ${telemetryWhereSql(where)}
    `);
    return Number(row.total);
  }

  async ingest(
    body: TelemetryPerfBody,
    ip: string | null,
  ): Promise<{ accepted: boolean; reason?: string }> {
    this.logger.log(
      `📥 收到测评数据: soc=${body?.device?.socName} model=${body?.model?.fileName} backend=${body?.model?.backend} prefill=${body?.perf?.prefillSpeed} decode=${body?.perf?.decodeSpeed} isBatch=${body?.perf?.isBatch} batchCount=${body?.perf?.batchCount} ip=${ip}`,
    );

    // Validate required fields (sha256 is optional — fileName serves as fallback identifier)
    if (!body?.device?.socName || !body?.model?.backend) {
      this.logger.warn('❌ 拒绝: missing_required_fields');
      return { accepted: false, reason: 'missing_required_fields' };
    }

    if (!body?.perf?.prefillSpeed || !body?.perf?.decodeSpeed) {
      this.logger.warn('❌ 拒绝: missing_speed');
      return { accepted: false, reason: 'missing_speed' };
    }

    if (!body?.installId) {
      this.logger.warn('❌ 拒绝: missing_install_id');
      return { accepted: false, reason: 'missing_install_id' };
    }

    // Speed range validation
    if (body.perf.prefillSpeed <= 0 || body.perf.prefillSpeed > MAX_PREFILL_SPEED) {
      this.logger.warn(`❌ 拒绝: invalid_prefill_speed (${body.perf.prefillSpeed})`);
      return { accepted: false, reason: 'invalid_prefill_speed' };
    }

    if (body.perf.decodeSpeed <= 0 || body.perf.decodeSpeed > MAX_DECODE_SPEED) {
      this.logger.warn(`❌ 拒绝: invalid_decode_speed (${body.perf.decodeSpeed})`);
      return { accepted: false, reason: 'invalid_decode_speed' };
    }

    const installIdHash = sha256(body.installId + TELEMETRY_SALT);
    const normalizedDevice = normalizeTelemetryDevice(
      {
        ...body.device,
      },
      body.model?.backend,
    );

    // Insert
    try {
      await this.prisma.telemetryPerf.create({
        data: {
          schemaVersion: body.schemaVersion ?? 1,
          installIdHash,
          // Retain reported identity so later alias corrections do not lose part revisions.
          socName: normalizeLookupKey(body.device?.socName) || normalizedDevice.socNameKey,
          socBrand: normalizedDevice.socBrand,
          os: normalizedDevice.os,
          osVersion: normalizedDevice.osVersion,
          deviceModel: normalizedDevice.deviceModel,
          cpuName: normalizedDevice.cpuName,
          gpuName: normalizedDevice.gpuName,
          totalMemoryMb: normalizedDevice.totalMemoryMb,
          totalVramMb: normalizedDevice.totalVramMb,
          ...normalizeTelemetryAppDimensions(body.app?.version, body.app?.buildMode),
          appBuild: body.app?.build ?? '',
          modelName: body.model.name ?? '',
          modelFileName: body.model.fileName ?? '',
          modelSha256: (body.model.sha256 || body.model.fileName || '').toLowerCase().trim(),
          modelSizeB: body.model.sizeB ?? null,
          quantization: body.model.quantization?.toLowerCase().trim() ?? null,
          backend: body.model.backend.toLowerCase().trim(),
          isBatch: body.perf.isBatch === true,
          batchCount: body.perf.batchCount ?? 1,
          prefillSpeed: body.perf.prefillSpeed,
          decodeSpeed: body.perf.decodeSpeed,
          clientTimestamp: new Date(body.clientTimestamp ?? Date.now()),
        },
      });
    } catch (e) {
      this.logger.error(`❌ 写入失败: ${e}`);
      return { accepted: false, reason: 'db_error' };
    }

    this.logger.log(
      `✅ 已入库: soc=${body.device.socName} decode=${body.perf.decodeSpeed} backend=${body.model.backend}`,
    );
    return { accepted: true };
  }

  leaderboard(query: LeaderboardQuery): Promise<any[]> {
    return this.cached(this.queryKey('leaderboard', query), () => this.queryLeaderboard(query));
  }

  private async queryLeaderboard(query: LeaderboardQuery): Promise<any[]> {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '100', 10) || 100, 1), 5000);

    const where: TelemetryWhere = {};
    if (query.modelSha256) where.modelSha256 = query.modelSha256.toLowerCase().trim();
    if (query.backend) where.backend = query.backend.toLowerCase().trim();
    applyStringFilter(where, 'os', parseLookupFilterList(query.os));
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    applyStringFilter(where, 'appVersion', parseFilterList(query.appVersion));
    applyStringFilter(where, 'buildMode', parseBuildModeFilterList(query.buildMode));

    const rows = await this.findTelemetryRows({
      where,
      select: {
        os: true,
        modelSha256: true,
        modelName: true,
        modelFileName: true,
        modelSizeB: true,
        quantization: true,
        socName: true,
        socBrand: true,
        osVersion: true,
        deviceModel: true,
        cpuName: true,
        gpuName: true,
        totalMemoryMb: true,
        totalVramMb: true,
        backend: true,
        isBatch: true,
        batchCount: true,
        decodeSpeed: true,
        prefillSpeed: true,
      },
    });

    const querySocNameKeys = new Set(parseFilterList(query.socName).map(normalizeSocFilterKey));
    const groups = new Map<string, LeaderboardAccumulator>();
    const socDisplayNames = new Map<string, string>();
    for (const rawRow of rows) {
      const row = normalizeTelemetryLeaderboardRow(rawRow);
      if (
        querySocNameKeys.size > 0 &&
        !querySocNameKeys.has(row.socNameKey) &&
        !querySocNameKeys.has(normalizeSocFilterKey(rawRow.socName))
      ) {
        continue;
      }
      row.socName = socDisplayNames.get(row.socNameKey) ?? row.socName;
      socDisplayNames.set(row.socNameKey, row.socName);

      const key = leaderboardGroupKey(row);
      const existing = groups.get(key);
      if (existing) {
        existing.sampleCount += 1;
        existing.reportedSocNames.add(rawRow.socName);
        if (row.deviceModel) {
          existing.deviceModelCounts.set(
            row.deviceModel,
            (existing.deviceModelCounts.get(row.deviceModel) ?? 0) + 1,
          );
        }
        for (const brand of collectHardwareBrandKeys(row)) {
          existing.hardwareBrands.add(brand);
        }
        existing.decodeValues.push(row.decodeSpeed);
        existing.prefillValues.push(row.prefillSpeed);
        existing.decodeTotal += row.decodeSpeed;
        existing.prefillTotal += row.prefillSpeed;
        existing.decodeMax =
          existing.decodeMax === null
            ? row.decodeSpeed
            : Math.max(existing.decodeMax, row.decodeSpeed);
        existing.prefillMax =
          existing.prefillMax === null
            ? row.prefillSpeed
            : Math.max(existing.prefillMax, row.prefillSpeed);
        continue;
      }

      groups.set(key, {
        os: row.os,
        modelSha256: row.modelSha256,
        modelName: row.modelName,
        modelFileName: row.modelFileName,
        modelSizeB: row.modelSizeB,
        quantization: row.quantization,
        socName: row.socName,
        reportedSocNames: new Set([rawRow.socName]),
        socBrand: row.socBrand,
        backend: row.backend,
        isBatch: row.isBatch,
        batchCount: row.batchCount,
        deviceModelCounts: row.deviceModel ? new Map([[row.deviceModel, 1]]) : new Map(),
        hardwareBrands: new Set(collectHardwareBrandKeys(row)),
        sampleCount: 1,
        decodeValues: [row.decodeSpeed],
        prefillValues: [row.prefillSpeed],
        decodeTotal: row.decodeSpeed,
        prefillTotal: row.prefillSpeed,
        decodeMax: row.decodeSpeed,
        prefillMax: row.prefillSpeed,
      });
    }

    return Array.from(groups.values())
      .map((group) => {
        const sortedDeviceModels = Array.from(group.deviceModelCounts.entries())
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .map(([deviceModel]) => deviceModel);

        const deviceDisplayNames = Array.from(
          new Set(
            sortedDeviceModels
              .map((deviceModel) => resolveDeviceDisplayName(group.os, deviceModel))
              .filter((value): value is string => Boolean(value)),
          ),
        );

        return {
          os: group.os,
          modelSha256: group.modelSha256,
          modelName: group.modelName,
          modelFileName: group.modelFileName,
          modelSizeB: group.modelSizeB,
          quantization: group.quantization,
          socName: group.socName,
          reportedSocNames: Array.from(group.reportedSocNames).sort(),
          socBrand: group.socBrand,
          hardwareBrands: ADMIN_FILTER_BRAND_ORDER.filter((brand) =>
            group.hardwareBrands.has(brand),
          ),
          deviceModels: sortedDeviceModels,
          deviceDisplayNames,
          backend: group.backend,
          isBatch: group.isBatch,
          batchCount: group.batchCount,
          sampleCount: group.sampleCount,
          decodeSpeed: {
            avg: roundSpeed(group.decodeTotal / group.sampleCount) ?? 0,
            max: roundSpeed(group.decodeMax),
            top10: roundSpeed(pickTopDecileValue(group.decodeValues)),
          },
          prefillSpeed: {
            avg: roundSpeed(group.prefillTotal / group.sampleCount) ?? 0,
            max: roundSpeed(group.prefillMax),
            top10: roundSpeed(pickTopDecileValue(group.prefillValues)),
          },
        };
      })
      .sort((a, b) => {
        const top10Diff =
          (b.decodeSpeed.top10 ?? b.decodeSpeed.avg) - (a.decodeSpeed.top10 ?? a.decodeSpeed.avg);
        if (top10Diff !== 0) return top10Diff;
        const avgDiff = b.decodeSpeed.avg - a.decodeSpeed.avg;
        if (avgDiff !== 0) return avgDiff;
        return b.sampleCount - a.sampleCount;
      })
      .slice(0, limit);
  }

  filters(): Promise<{ appVersions: string[]; buildModes: TelemetryBuildMode[] }> {
    return this.cached('filters', () => this.queryFilters());
  }

  private async queryFilters(): Promise<{
    appVersions: string[];
    buildModes: TelemetryBuildMode[];
  }> {
    const versions = await this.prisma.telemetryPerf.groupBy({
      by: ['appVersion'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const appVersions = [
      ...new Set(
        versions
          .map((v) => normalizeTelemetryAppVersion(v.appVersion))
          .filter((v) => v && v.length > 0),
      ),
    ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return { appVersions, buildModes: [...TELEMETRY_BUILD_MODE_ORDER] };
  }

  records(query: RecordsQuery): Promise<any[]> {
    return this.cached(this.queryKey('records', query), () => this.queryRecords(query));
  }

  private async queryRecords(query: RecordsQuery): Promise<any[]> {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 200);

    const where: TelemetryWhere = {
      modelSha256: query.modelSha256.toLowerCase().trim(),
      backend: query.backend.toLowerCase().trim(),
    };
    if (query.os) where.os = query.os.toLowerCase().trim();
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    if (query.batchCount !== undefined)
      where.batchCount = Math.max(parseInt(query.batchCount, 10) || 1, 1);
    applyStringFilter(where, 'appVersion', parseFilterList(query.appVersion));
    applyStringFilter(where, 'buildMode', parseBuildModeFilterList(query.buildMode));

    const rows = await this.findTelemetryRows({
      where,
      select: {
        id: true,
        socName: true,
        socBrand: true,
        os: true,
        osVersion: true,
        deviceModel: true,
        cpuName: true,
        gpuName: true,
        totalMemoryMb: true,
        totalVramMb: true,
        appVersion: true,
        appBuild: true,
        buildMode: true,
        modelName: true,
        modelFileName: true,
        modelSha256: true,
        modelSizeB: true,
        quantization: true,
        backend: true,
        isBatch: true,
        batchCount: true,
        prefillSpeed: true,
        decodeSpeed: true,
        clientTimestamp: true,
        createdAt: true,
      },
    });

    const querySocNameKey = normalizeSocFilterKey(query.socName);

    return rows
      .map((row) => normalizeTelemetryRecordRow(row))
      .filter(
        (row) =>
          row.socNameKey === querySocNameKey ||
          (query.socMatch !== 'canonical' &&
            normalizeSocFilterKey(row.reportedSocName) === querySocNameKey),
      )
      .sort((left, right) => right.decodeSpeed - left.decodeSpeed)
      .slice(0, limit)
      .map(({ socNameKey, ...row }) => ({
        ...row,
        deviceDisplayName: resolveDeviceDisplayName(row.os, row.deviceModel),
      }));
  }

  async adminRecords(query: AdminRecordsQuery): Promise<{
    items: any[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '100', 10) || 100, 1), 200);
    const page = Math.max(parseInt(query.page ?? '1', 10) || 1, 1);
    const skip = (page - 1) * limit;

    const where: TelemetryWhere = {};
    const recordId = Math.max(parseInt(query.recordId ?? '', 10) || 0, 0);
    if (recordId > 0) where.id = recordId;
    const osValues = parseLookupFilterList(query.os);
    applyStringFilter(where, 'os', osValues);
    const appVersionValues = parseFilterList(query.appVersion);
    applyStringFilter(where, 'appVersion', appVersionValues);
    const buildModeValues = parseBuildModeFilterList(query.buildMode);
    applyStringFilter(where, 'buildMode', buildModeValues);
    const batchCountValues = parseNumberFilterList(query.batchCount);
    applyNumberFilter(where, 'batchCount', batchCountValues);

    const modelTagValues = new Set(parseFilterList(query.modelTag));
    const modelSizeValues = new Set(parseFilterList(query.modelSize));
    const socBrandValues = new Set(
      parseLookupFilterList(query.socBrand).map((brand) =>
        brand === 'snapdragon' ? 'qualcomm' : brand,
      ),
    );
    const socNameKeys = new Set(
      parseSocNameFilters(query.socName, query.socMatch)
        .map(normalizeSocFilterKey)
        .filter((socName) => socName.length > 0),
    );
    const hasDerivedFilters =
      modelTagValues.size > 0 ||
      modelSizeValues.size > 0 ||
      socBrandValues.size > 0 ||
      socNameKeys.size > 0;

    const select = {
      id: true,
      socName: true,
      socBrand: true,
      os: true,
      osVersion: true,
      deviceModel: true,
      cpuName: true,
      gpuName: true,
      totalMemoryMb: true,
      totalVramMb: true,
      appVersion: true,
      appBuild: true,
      buildMode: true,
      modelName: true,
      modelFileName: true,
      modelSha256: true,
      modelSizeB: true,
      quantization: true,
      backend: true,
      isBatch: true,
      batchCount: true,
      prefillSpeed: true,
      decodeSpeed: true,
    };

    type AdminRecordRow = Prisma.TelemetryPerfGetPayload<{ select: typeof select }>;
    const decorateRows = (rows: AdminRecordRow[]) =>
      rows.map((row) => {
        const normalized = normalizeTelemetryDevice(row, row.backend);
        return {
          ...row,
          ...normalized,
          ...normalizeTelemetryAppDimensions(row.appVersion, row.buildMode),
          deviceDisplayName: resolveDeviceDisplayName(normalized.os, normalized.deviceModel),
        };
      });

    const matchesDerivedFilters = (row: AdminRecordRow) => {
      const normalized = normalizeTelemetryDevice(row, row.backend);
      if (modelTagValues.size > 0 && !modelTagValues.has(deriveAdminModelTag(row))) {
        return false;
      }
      if (modelSizeValues.size > 0 && !modelSizeValues.has(deriveAdminWeightLabel(row))) {
        return false;
      }
      if (
        socBrandValues.size > 0 &&
        !collectHardwareBrandKeys(normalized).some((brand) => socBrandValues.has(brand))
      ) {
        return false;
      }
      if (
        socNameKeys.size > 0 &&
        !socNameKeys.has(normalized.socNameKey) &&
        (query.socMatch === 'canonical' || !socNameKeys.has(normalizeSocFilterKey(row.socName)))
      ) {
        return false;
      }
      return true;
    };

    if (!hasDerivedFilters) {
      const [total, rows] = await Promise.all([
        this.countTelemetryRows(where),
        this.findTelemetryRows({
          where,
          select,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
      ]);

      return {
        items: decorateRows(rows),
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      };
    }

    const rows = await this.findTelemetryRows({
      where,
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const filteredRows = rows.filter(matchesDerivedFilters);
    const total = filteredRows.length;

    return {
      items: decorateRows(filteredRows.slice(skip, skip + limit)),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  async adminFilters(): Promise<{
    os: string[];
    appVersions: string[];
    buildModes: TelemetryBuildMode[];
    batchCounts: number[];
    modelTags: string[];
    modelSizes: string[];
    socBrands: string[];
    socs: string[];
  }> {
    const rows = await this.findTelemetryRows({
      select: {
        os: true,
        appVersion: true,
        batchCount: true,
        modelName: true,
        modelFileName: true,
        modelSizeB: true,
        socName: true,
        socBrand: true,
        cpuName: true,
        gpuName: true,
        deviceModel: true,
        backend: true,
      },
    });

    const osSet = new Set<string>();
    const appVersionSet = new Set<string>();
    const batchCountSet = new Set<number>();
    const modelTagSet = new Set<string>();
    const modelSizeSet = new Set<string>();
    const socBrandSet = new Set<string>();
    const socCounts = new Map<string, { name: string; count: number }>();

    for (const row of rows) {
      if (row.os) osSet.add(row.os);
      if (row.appVersion) appVersionSet.add(normalizeTelemetryAppVersion(row.appVersion));
      if (row.batchCount) batchCountSet.add(row.batchCount);

      modelTagSet.add(deriveAdminModelTag(row));
      modelSizeSet.add(deriveAdminWeightLabel(row));

      const normalized = normalizeTelemetryDevice(row, row.backend);
      for (const brand of collectHardwareBrandKeys(normalized)) {
        socBrandSet.add(brand);
      }
      if (normalized.socName) {
        const previous = socCounts.get(normalized.socNameKey);
        socCounts.set(normalized.socNameKey, {
          name: previous?.name ?? normalized.socName,
          count: (previous?.count ?? 0) + 1,
        });
      }
    }

    const os = Array.from(osSet).sort((left, right) => {
      const leftIndex = ADMIN_FILTER_OS_ORDER.indexOf(left);
      const rightIndex = ADMIN_FILTER_OS_ORDER.indexOf(right);
      if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
      if (leftIndex !== -1) return -1;
      if (rightIndex !== -1) return 1;
      return left.localeCompare(right);
    });

    return {
      os,
      appVersions: Array.from(appVersionSet).sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true }),
      ),
      buildModes: [...TELEMETRY_BUILD_MODE_ORDER],
      batchCounts: Array.from(batchCountSet).sort((left, right) => left - right),
      modelTags: ADMIN_FILTER_MODEL_TAG_ORDER.filter((tag) => modelTagSet.has(tag)),
      modelSizes: Array.from(modelSizeSet).sort((left, right) => {
        const sortDiff = deriveAdminWeightSortValue(left) - deriveAdminWeightSortValue(right);
        return sortDiff || left.localeCompare(right, undefined, { numeric: true });
      }),
      socBrands: ADMIN_FILTER_BRAND_ORDER.filter((brand) => socBrandSet.has(brand)),
      socs: Array.from(socCounts.values())
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
        .map(({ name }) => name),
    };
  }
}
