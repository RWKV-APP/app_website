import type { LocationInfo } from '@/atoms';
import type { LatestDistributionsResponse } from '@/types/distribution';

const HOMEPAGE_CACHE_KEY = 'rwkv-homepage-cache-v1';
const HOMEPAGE_CACHE_VERSION = 1;

interface HomepageCachePayload {
  version: number;
  distributions: LatestDistributionsResponse | null;
  location: LocationInfo | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocationInfo(value: unknown): value is LocationInfo {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.country === 'string' &&
    typeof value.countryCode === 'string' &&
    typeof value.region === 'string' &&
    typeof value.regionCode === 'string' &&
    typeof value.isMainlandChina === 'boolean'
  );
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function normalizeDistributions(value: unknown): LatestDistributionsResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  return value as LatestDistributionsResponse;
}

function normalizeLocation(value: unknown): LocationInfo | null {
  return isLocationInfo(value) ? value : null;
}

function getEmptyHomepageCache(): HomepageCachePayload {
  return {
    version: HOMEPAGE_CACHE_VERSION,
    distributions: null,
    location: null,
  };
}

export function loadHomepageCache(): HomepageCachePayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(HOMEPAGE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== HOMEPAGE_CACHE_VERSION) {
      return null;
    }

    return {
      version: HOMEPAGE_CACHE_VERSION,
      distributions: normalizeDistributions(parsed.distributions),
      location: normalizeLocation(parsed.location),
    };
  } catch (error) {
    console.debug('Failed to load homepage cache:', error);
    return null;
  }
}

export function saveHomepageCache(next: {
  distributions?: LatestDistributionsResponse | null;
  location?: LocationInfo | null;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = loadHomepageCache() ?? getEmptyHomepageCache();
  const payload: HomepageCachePayload = {
    version: HOMEPAGE_CACHE_VERSION,
    distributions:
      next.distributions === undefined ? current.distributions : next.distributions,
    location: next.location === undefined ? current.location : next.location,
  };

  try {
    localStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.debug('Failed to save homepage cache:', error);
  }
}

export function getLatestDistributionsSignature(
  distributions: LatestDistributionsResponse | null,
): string {
  return JSON.stringify(sortValue(distributions ?? null));
}

export function areLatestDistributionsEqual(
  left: LatestDistributionsResponse | null,
  right: LatestDistributionsResponse | null,
): boolean {
  return getLatestDistributionsSignature(left) === getLatestDistributionsSignature(right);
}

export function getLocationSignature(location: LocationInfo | null): string {
  return JSON.stringify(sortValue(location ?? null));
}

export function areLocationsEqual(
  left: LocationInfo | null,
  right: LocationInfo | null,
): boolean {
  return getLocationSignature(left) === getLocationSignature(right);
}
