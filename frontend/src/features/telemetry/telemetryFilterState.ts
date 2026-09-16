import { normalizeTelemetryAppDimensions } from '@app/contracts';
import type { TelemetryFilterSelections } from './telemetryFilters';
import { getBackendFamily } from './telemetryRules';

export type TelemetryFilterState = TelemetryFilterSelections & {
  selectedVersion: string[];
  selectedBuildMode: string[];
  search: string;
};

export const FILTER_STORAGE_KEY = 'rwkv-perf-filters-v1';

export function defaultTelemetryFilters(): TelemetryFilterState {
  return {
    selectedPlatforms: [],
    selectedBackend: [],
    selectedBatch: [],
    selectedSize: [],
    selectedModelTag: ['Chat'],
    selectedBrand: [],
    selectedSoc: [],
    selectedVersion: [],
    selectedBuildMode: [],
    search: '',
  };
}

export function parseTelemetryFilterState(value: string | null): TelemetryFilterState | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const state = defaultTelemetryFilters();
    const fields = parsed as Record<string, unknown>;
    for (const key of Object.keys(state) as Array<keyof TelemetryFilterState>) {
      const field = fields[key];
      if (key === 'search') {
        if (typeof field === 'string') state.search = field;
      } else if (Array.isArray(field) && field.every((item) => typeof item === 'string')) {
        state[key] = Array.from(new Set(field.filter(Boolean)));
      }
    }
    // Historical variant selections now select the complete NeuroPilot family.
    state.selectedBackend = Array.from(new Set(state.selectedBackend.map(getBackendFamily)));
    const versions = state.selectedVersion.map((version) =>
      normalizeTelemetryAppDimensions(version),
    );
    // A saved flavor-only version selection keeps its original mode constraint.
    if (
      !state.selectedBuildMode.length &&
      versions.length &&
      versions.every((version) => version.buildMode !== 'unknown')
    ) {
      state.selectedBuildMode = Array.from(new Set(versions.map((version) => version.buildMode)));
    }
    state.selectedVersion = Array.from(new Set(versions.map((version) => version.appVersion)));
    return state;
  } catch {
    return null;
  }
}

// The rendered rows and actions must belong to the currently selected server query.
export function telemetryQueryKey(versions: string[], buildModes: string[]): string {
  return JSON.stringify([[...versions].sort(), [...buildModes].sort()]);
}
