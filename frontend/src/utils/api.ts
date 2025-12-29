import { LatestDistributionsResponse } from '@/types/distribution';
import { LocationInfo } from '@/atoms';

// Use api.rwkv.halowang.cloud in production, or env variable if set
// In development, fallback to localhost
const getApiBaseUrl = (): string => {
  // Allow override via environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser, check if we're on production domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If on rwkv.halowang.cloud, use api.rwkv.halowang.cloud
    if (hostname === 'rwkv.halowang.cloud') {
      return 'https://api.rwkv.halowang.cloud';
    }
    // Otherwise use relative path (for same-domain deployment)
    return '';
  }

  // Server-side rendering fallback (development)
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

export async function fetchLatestDistributions(): Promise<LatestDistributionsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/distributions/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch latest distributions:', error);
    return {} as LatestDistributionsResponse;
  }
}

export async function fetchLocation(): Promise<LocationInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/location`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch location:', error);
    return null;
  }
}
