import {
  TELEMETRY_ADMIN_FILTER_BRAND_ORDER,
  TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER,
  TELEMETRY_ADMIN_FILTER_OS_ORDER,
  TELEMETRY_BUILD_MODE_ORDER,
} from '@app/contracts';
import type { TelemetryLeaderboardEntry } from '@/types/telemetry';

export type CellMetricBasis = 'top10' | 'decode_div_batch';

export const OS_LABELS: Record<string, string> = {
  macos: 'macOS',
  android: '安卓',
  ios: 'iOS',
  windows: 'Windows',
  linux: 'Linux',
};

export const OS_ORDER: readonly string[] = TELEMETRY_ADMIN_FILTER_OS_ORDER;

export const BRAND_LABELS: Record<string, string> = {
  apple: 'Apple',
  qualcomm: 'Qualcomm',
  snapdragon: 'Qualcomm',
  nvidia: 'NVIDIA',
  amd: 'AMD',
  intel: 'Intel',
  mediatek: 'MediaTek',
  samsung: 'Samsung',
  google: 'Google',
  huawei: 'Huawei',
};

export const BUILD_MODE_LABELS: Record<string, string> = {
  ...Object.fromEntries(TELEMETRY_BUILD_MODE_ORDER.map((mode) => [mode, mode])),
  unknown: '未知',
};

export const BRAND_ORDER: readonly string[] = TELEMETRY_ADMIN_FILTER_BRAND_ORDER;

export const MODEL_TAG_LABELS: Record<string, string> = Object.fromEntries(
  TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER.map((tag) => [tag, tag]),
);

export function inferBrand(socName: string, socBrand: string): string {
  if (socBrand && socBrand !== 'unknown') {
    if (socBrand.toLowerCase() === 'snapdragon') return 'qualcomm';
    return socBrand.toLowerCase();
  }
  const lower = socName.toLowerCase();
  if (lower.includes('rtx') || lower.includes('gtx') || lower.includes('nvidia')) return 'nvidia';
  if (lower.includes('radeon') || lower.includes('amd') || lower.includes('rx ')) return 'amd';
  if (lower.includes('intel') || lower.includes('arc ')) return 'intel';
  if (
    lower.includes('apple') ||
    lower.includes('iphone') ||
    lower.includes('ipad') ||
    lower.includes('ipod') ||
    /^a\d+(?:\s+(?:pro|max|bionic))?$/.test(lower.trim()) ||
    lower.includes(' m1') ||
    lower.includes(' m2') ||
    lower.includes(' m3') ||
    lower.includes(' m4')
  ) {
    return 'apple';
  }
  if (lower.includes('mediatek') || lower.includes('dimensity') || lower.includes('helio')) {
    return 'mediatek';
  }
  if (lower.includes('kirin')) return 'huawei';
  if (
    lower.includes('google tensor') ||
    lower.includes('tensor_soc') ||
    /\btensor\s*g\d+\b/.test(lower) ||
    /\bpixel\s*7(?:\s*pro|\s*a)?\b/.test(lower)
  ) {
    return 'google';
  }
  if (lower.includes('exynos') || lower.includes('samsung')) return 'samsung';
  return 'unknown';
}

export function deriveWeightLabel(entry: TelemetryLeaderboardEntry): string {
  const size = entry.modelSizeB;
  if (size != null && size > 0) {
    return `${size}B`;
  }
  const match = entry.modelFileName.match(/(\d+\.?\d*)B/i);
  if (match) return `${match[1]}B`;
  return entry.modelName || entry.modelFileName;
}

export function deriveQuantLabel(entry: TelemetryLeaderboardEntry): string {
  if (entry.quantization) return entry.quantization.toUpperCase();
  const match = entry.modelFileName.match(/\d+\.?\d*B[_-]?([\w_]+?)\.gguf/i);
  if (match) return match[1].toUpperCase();
  return entry.backend;
}

export function deriveSortOrder(entry: TelemetryLeaderboardEntry): number {
  if (entry.modelSizeB != null && entry.modelSizeB > 0) return entry.modelSizeB;
  const match = entry.modelFileName.match(/(\d+\.?\d*)B/i);
  if (match) return parseFloat(match[1]);
  return 999;
}

export function capitalizeBrand(brand: string): string {
  if (!brand) return '';
  const map: Record<string, string> = {
    snapdragon: 'Qualcomm',
    qualcomm: 'Qualcomm',
    mediatek: 'MediaTek',
    apple: 'Apple',
    samsung: 'Samsung',
    nvidia: 'NVIDIA',
    amd: 'AMD',
    intel: 'Intel',
    unknown: '',
    google: 'Google',
    huawei: 'Huawei',
  };
  return map[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function formatSpeed(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

export function formatHardwareSummary(cpuName: string | null, gpuName: string | null): string {
  if (cpuName && gpuName) return `${cpuName} / ${gpuName}`;
  if (cpuName) return cpuName;
  if (gpuName) return gpuName;
  return '—';
}

export function toggleFilterValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}

export function formatFilterSelection(
  values: string[],
  allLabel: string,
  formatValue: (value: string) => string = (value) => value,
): string {
  return values.length === 0 ? allLabel : values.map(formatValue).join('+');
}

export function deriveModelTag(entry: TelemetryLeaderboardEntry): string {
  const name = (entry.modelName || entry.modelFileName).toLowerCase();
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

export function isBatchColumn(input: { isBatch: boolean; batchCount: number }): boolean {
  return input.isBatch && input.batchCount > 1;
}

export function getMetricBasis(input: { isBatch: boolean; batchCount: number }): CellMetricBasis {
  return isBatchColumn(input) ? 'decode_div_batch' : 'top10';
}

export function getDisplaySpeeds(entry: TelemetryLeaderboardEntry): {
  prefill: number | null;
  decode: number | null;
  decodeRaw: number | null;
  metricBasis: CellMetricBasis;
} {
  const metricBasis = getMetricBasis(entry);
  const prefillBase = entry.prefillSpeed.top10 ?? entry.prefillSpeed.max ?? entry.prefillSpeed.avg;
  const decodeBase = entry.decodeSpeed.top10 ?? entry.decodeSpeed.max ?? entry.decodeSpeed.avg;
  if (metricBasis === 'decode_div_batch') {
    return {
      prefill: prefillBase,
      decode: entry.batchCount > 0 ? decodeBase / entry.batchCount : decodeBase,
      decodeRaw: decodeBase,
      metricBasis,
    };
  }
  return {
    prefill: prefillBase,
    decode: decodeBase,
    decodeRaw: decodeBase,
    metricBasis,
  };
}

export function formatMetricBasisLabel(metricBasis: CellMetricBasis): string {
  return metricBasis === 'decode_div_batch' ? 'decode / batchCount' : 'top10';
}

export function filterLeaderboardData(
  data: TelemetryLeaderboardEntry[],
  filters: {
    selectedPlatforms: string[];
    selectedBatch: string[];
    selectedSize: string[];
    selectedModelTag: string[];
    selectedBrand: string[];
    selectedSoc: string[];
  },
): TelemetryLeaderboardEntry[] {
  let filtered = data;
  if (filters.selectedPlatforms.length > 0) {
    filtered = filtered.filter((entry) => filters.selectedPlatforms.includes(entry.os));
  }
  if (filters.selectedBatch.length > 0) {
    const batchCounts = new Set(filters.selectedBatch.map((value) => parseInt(value, 10)));
    filtered = filtered.filter((entry) => batchCounts.has(entry.batchCount));
  }
  if (filters.selectedSize.length > 0) {
    filtered = filtered.filter((entry) => filters.selectedSize.includes(deriveWeightLabel(entry)));
  }
  if (filters.selectedModelTag.length > 0) {
    filtered = filtered.filter((entry) => filters.selectedModelTag.includes(deriveModelTag(entry)));
  }
  if (filters.selectedBrand.length > 0) {
    filtered = filtered.filter((entry) =>
      filters.selectedBrand.includes(inferBrand(entry.socName, entry.socBrand)),
    );
  }
  if (filters.selectedSoc.length > 0) {
    filtered = filtered.filter((entry) => filters.selectedSoc.includes(entry.socName));
  }
  return filtered;
}
