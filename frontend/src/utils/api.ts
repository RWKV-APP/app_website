import { LatestDistributionsResponse } from '@/types/distribution';
import { LocationInfo } from '@/atoms';

// Use relative path in production (same domain), or env variable if set
// In development, fallback to localhost
const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // In browser, use relative path (works for same-domain deployment)
  if (typeof window !== 'undefined') {
    return '/api';
  }
  // Server-side rendering fallback (development)
  return 'http://localhost:3001/api';
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
