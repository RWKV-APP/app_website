import { TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER } from '@app/contracts';
import type { TelemetryLeaderboardEntry } from '@/types/telemetry';
import {
  BRAND_ORDER,
  OS_ORDER,
  deriveModelTag,
  deriveWeightLabel,
  getBackendFamily,
  getHardwareBrandKeys,
  telemetrySocFilterLabels,
} from './telemetryRules';
import { formatConsumerSocName } from '../../utils/appleDeviceInfo';

export type TelemetryFilterSelections = {
  selectedPlatforms: string[];
  selectedBackend: string[];
  selectedBatch: string[];
  selectedSize: string[];
  selectedModelTag: string[];
  selectedBrand: string[];
  selectedSoc: string[];
};

const FILTER_KEYS: (keyof TelemetryFilterSelections)[] = [
  'selectedPlatforms',
  'selectedBackend',
  'selectedBatch',
  'selectedSize',
  'selectedModelTag',
  'selectedBrand',
  'selectedSoc',
];

const FIXED_ORDER: Partial<Record<keyof TelemetryFilterSelections, readonly string[]>> = {
  selectedPlatforms: OS_ORDER,
  selectedModelTag: TELEMETRY_ADMIN_FILTER_MODEL_TAG_ORDER,
  selectedBrand: BRAND_ORDER,
};

/** Each facet ignores its own selection and matches every other selected group. */
export function getTelemetryFilterOptions(
  data: TelemetryLeaderboardEntry[],
  filters: TelemetryFilterSelections,
): Record<keyof TelemetryFilterSelections, string[]> {
  const selections = FILTER_KEYS.map(
    (key) =>
      new Set(key === 'selectedSoc' ? telemetrySocFilterLabels(data, filters[key]) : filters[key]),
  );
  const counts = FILTER_KEYS.map(() => new Map<string, number>());

  for (const entry of data) {
    const attributes: TelemetryFilterSelections = {
      selectedPlatforms: [entry.os],
      selectedBackend: [getBackendFamily(entry.backend)],
      selectedBatch: [String(entry.batchCount)],
      selectedSize: [deriveWeightLabel(entry)],
      selectedModelTag: [deriveModelTag(entry)],
      selectedBrand: getHardwareBrandKeys(entry),
      selectedSoc: [formatConsumerSocName(entry.socName)],
    };
    const failedGroups = FILTER_KEYS.filter(
      (key, index) =>
        selections[index].size > 0 &&
        !attributes[key].some((value) => selections[index].has(value)),
    );
    if (failedGroups.length > 1) continue;

    FILTER_KEYS.forEach((key, index) => {
      if (failedGroups.length === 1 && failedGroups[0] !== key) return;
      for (const value of attributes[key]) {
        counts[index].set(value, (counts[index].get(value) ?? 0) + entry.sampleCount);
      }
    });
  }

  return Object.fromEntries(
    FILTER_KEYS.map((key, index) => {
      const order = FIXED_ORDER[key];
      const values = Array.from(counts[index].keys()).sort((a, b) => {
        if (key === 'selectedSoc') {
          const unknownOrder = Number(a.includes('型号待识别')) - Number(b.includes('型号待识别'));
          if (unknownOrder) return unknownOrder;
        }
        if (order) {
          const rank = (value: string) => {
            const position = order.indexOf(value);
            return position < 0 ? order.length : position;
          };
          return rank(a) - rank(b) || a.localeCompare(b);
        }
        if (key === 'selectedBatch' || key === 'selectedSize') {
          const numericRank = (value: string) => {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? parsed : Infinity;
          };
          return numericRank(a) - numericRank(b) || a.localeCompare(b);
        }
        return (counts[index].get(b) ?? 0) - (counts[index].get(a) ?? 0) || a.localeCompare(b);
      });
      return [key, values];
    }),
  ) as Record<keyof TelemetryFilterSelections, string[]>;
}
