import { LatestDistributionsResponse } from '@/types/distribution';
import { EvalImportResult, EvalQuestionsResponse, EvalRunRecord } from '@/types/eval';
import { LocationInfo } from '@/atoms';
import {
  AdminLoginResponse,
  AdminSessionResponse,
  RemoteConfigActivityRecord,
  RemoteConfigFileRecord,
  RemoteConfigVersionContentResponse,
  UploadRemoteConfigRequest,
  UploadRemoteConfigResponse,
} from '@/types/remote-config';

// Use api.rwkv.halowang.cloud in production, or env variable if set
// In development, use relative path to leverage Next.js rewrites
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
    // In development, use relative path to leverage Next.js rewrites
    // This will proxy to http://localhost:3462 via rewrites
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    // Otherwise use relative path (for same-domain deployment)
    return '';
  }

  // Server-side rendering: use relative path in dev (rewrites work), or production URL
  return '';
};

const API_BASE_URL = getApiBaseUrl();
const ADMIN_TOKEN_STORAGE_KEY = 'rwkv-admin-token';

function getAdminToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function clearAdminToken() {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

function saveAdminToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

async function parseErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const message = data?.message;
      if (Array.isArray(message)) {
        return message.join('\n');
      }
      if (typeof message === 'string') {
        return message;
      }
      return JSON.stringify(data);
    }
    const text = await response.text();
    return text || `HTTP error ${response.status}`;
  } catch {
    return `HTTP error ${response.status}`;
  }
}

async function adminFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(options?.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAdminToken();
  }

  return response;
}

export async function fetchLatestDistributions(): Promise<LatestDistributionsResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/distributions/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch latest distributions:', error);
    return null;
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

export async function loginAdmin(options: {
  username: string;
  password: string;
}): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/admin-api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = (await response.json()) as AdminLoginResponse;
  saveAdminToken(data.token);
  return data;
}

export async function fetchAdminSession(): Promise<AdminSessionResponse | null> {
  const token = getAdminToken();
  if (!token) {
    return null;
  }

  const response = await adminFetch('/admin-api/auth/session');
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as AdminSessionResponse;
}

export async function logoutAdmin() {
  const response = await adminFetch('/admin-api/auth/logout', {
    method: 'POST',
  });
  clearAdminToken();
  if (!response.ok && response.status !== 401) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function fetchAdminRemoteConfigFiles(): Promise<RemoteConfigFileRecord[]> {
  const response = await adminFetch('/admin-api/remote-configs/files');
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as RemoteConfigFileRecord[];
}

export async function fetchAdminRemoteConfigActivities(
  limit = 60,
): Promise<RemoteConfigActivityRecord[]> {
  const response = await adminFetch(`/admin-api/remote-configs/activities?limit=${limit}`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as RemoteConfigActivityRecord[];
}

export async function uploadEvalSample(payload: {
  fileName: string;
  content: string;
  deviceLabel?: string;
  deviceChip?: string;
}): Promise<EvalImportResult> {
  const response = await adminFetch('/admin-api/evals/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as EvalImportResult;
}

export async function fetchAdminEvalRuns(): Promise<EvalRunRecord[]> {
  const response = await adminFetch('/admin-api/evals/runs');
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalRunRecord[];
}

export async function fetchPublicEvalRuns(): Promise<EvalRunRecord[]> {
  const response = await fetch(`${API_BASE_URL}/public-api/evals/runs`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalRunRecord[];
}

export async function fetchPublicEvalQuestions(options?: {
  runId?: string;
  language?: string;
  category?: string;
  search?: string;
  minAverageScore?: number;
  maxAverageScore?: number;
  limit?: number | 'all';
}): Promise<EvalQuestionsResponse> {
  const params = new URLSearchParams();
  if (options?.runId) {
    params.set('runId', options.runId);
  }
  if (options?.language) {
    params.set('language', options.language);
  }
  if (options?.category) {
    params.set('category', options.category);
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  if (typeof options?.minAverageScore === 'number') {
    params.set('minAverageScore', String(options.minAverageScore));
  }
  if (typeof options?.maxAverageScore === 'number') {
    params.set('maxAverageScore', String(options.maxAverageScore));
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options?.limit === 'all') {
    params.set('limit', 'all');
  }

  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/public-api/evals/questions${query ? `?${query}` : ''}`,
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalQuestionsResponse;
}

export async function uploadRemoteConfig(
  payload: UploadRemoteConfigRequest,
): Promise<UploadRemoteConfigResponse> {
  const response = await adminFetch('/admin-api/remote-configs/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as UploadRemoteConfigResponse;
}

export async function publishRemoteConfigVersion(id: number): Promise<void> {
  const response = await adminFetch(`/admin-api/remote-configs/${id}/publish`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function fetchRemoteConfigVersionContent(
  id: number,
): Promise<RemoteConfigVersionContentResponse> {
  const response = await adminFetch(`/admin-api/remote-configs/${id}/content`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as RemoteConfigVersionContentResponse;
}

async function downloadBlob(path: string, fallbackFileName: string) {
  const response = await adminFetch(path);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename=\"?([^"]+)\"?/);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackFileName;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadRemoteConfigVersion(id: number) {
  await downloadBlob(`/admin-api/remote-configs/${id}/download`, `remote-config-${id}.json`);
}

export async function downloadRemoteConfigArchive(scope: 'all' | 'published') {
  await downloadBlob(
    `/admin-api/remote-configs/archive/download?scope=${scope}`,
    `remote-configs-${scope}.zip`,
  );
}

export interface ReleaseNote {
  build: number;
  version: string;
  content: string;
}

export async function fetchAllReleaseNotes(options?: { locale?: string }): Promise<ReleaseNote[]> {
  try {
    const locale = options?.locale || 'zh-CN';
    const url = `${API_BASE_URL}/distributions/release-notes/all${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch all release notes:', error);
    return [];
  }
}
