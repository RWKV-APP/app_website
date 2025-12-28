import { LatestDistributionsResponse } from '@/types/distribution';
import { LocationInfo } from '@/atoms';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

