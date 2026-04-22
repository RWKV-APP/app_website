import { LatestDistributionsResponse } from '@/types/distribution';
import {
  EvalRunDetailRecord,
  EvalRunImportResult,
  EvalRunSummaryRecord,
  EvalSampleRecord,
  EvalSamplesResponse,
  EvalSettingsRecord,
} from '@/types/eval';
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

export interface AdminTelemetryPerfRecord {
  id: number;
  socName: string;
  socBrand: string;
  os: string;
  osVersion: string | null;
  deviceModel: string | null;
  deviceDisplayName: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
  appVersion: string;
  appBuild: string;
  buildMode: string;
  modelName: string;
  modelFileName: string;
  modelSha256: string;
  modelSizeB: number | null;
  quantization: string | null;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  prefillSpeed: number;
  decodeSpeed: number;
}

export interface AdminTelemetryPerfRecordsPage {
  items: AdminTelemetryPerfRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTelemetryPerfFilters {
  os: string[];
  appVersions: string[];
  buildModes: string[];
  batchCounts: number[];
  modelTags: string[];
  modelSizes: string[];
  socBrands: string[];
  socs: string[];
}

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

export async function uploadEvalRunArchive(file: File): Promise<EvalRunImportResult> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await adminFetch('/admin-api/evals/upload-run', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as EvalRunImportResult;
}

export async function fetchAdminEvalSettings(): Promise<EvalSettingsRecord> {
  const response = await adminFetch('/admin-api/evals/settings');
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalSettingsRecord;
}

export async function updateAdminEvalSettings(passThreshold: number): Promise<EvalSettingsRecord> {
  const response = await adminFetch('/admin-api/evals/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ passThreshold }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as EvalSettingsRecord;
}

export async function fetchAdminEvalRuns(): Promise<EvalRunSummaryRecord[]> {
  const response = await adminFetch('/admin-api/evals/runs');
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalRunSummaryRecord[];
}

export async function fetchAdminTelemetryRecords(options?: {
  page?: number;
  limit?: number;
  recordId?: number;
  os?: string | string[];
  appVersion?: string | string[];
  buildMode?: string | string[];
  batchCount?: number | number[];
  modelTag?: string | string[];
  modelSize?: string | string[];
  socBrand?: string | string[];
  socName?: string | string[];
}): Promise<AdminTelemetryPerfRecordsPage> {
  const params = new URLSearchParams();
  const setFilterParam = (key: string, value?: string | string[] | number | number[]) => {
    if (value === undefined) return;
    const values = (Array.isArray(value) ? value : [value])
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0 && item !== 'all');
    if (values.length > 0) {
      params.set(key, values.join(','));
    }
  };

  if (typeof options?.page === 'number') {
    params.set('page', String(options.page));
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options?.recordId === 'number') {
    params.set('recordId', String(options.recordId));
  }
  setFilterParam('os', options?.os);
  setFilterParam('appVersion', options?.appVersion);
  setFilterParam('buildMode', options?.buildMode);
  setFilterParam('batchCount', options?.batchCount);
  setFilterParam('modelTag', options?.modelTag);
  setFilterParam('modelSize', options?.modelSize);
  setFilterParam('socBrand', options?.socBrand);
  setFilterParam('socName', options?.socName);
  const query = params.toString();
  const response = await adminFetch(`/admin-api/telemetry/records${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as AdminTelemetryPerfRecordsPage;
}

export async function fetchAdminTelemetryFilters(): Promise<AdminTelemetryPerfFilters> {
  const response = await adminFetch('/admin-api/telemetry/filters');
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as AdminTelemetryPerfFilters;
}

export async function fetchPublicEvalRuns(): Promise<EvalRunSummaryRecord[]> {
  const response = await fetch(`${API_BASE_URL}/public-api/evals/runs`);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalRunSummaryRecord[];
}

export async function fetchPublicEvalRunDetail(runId: string): Promise<EvalRunDetailRecord> {
  const response = await fetch(
    `${API_BASE_URL}/public-api/evals/runs/${encodeURIComponent(runId)}`,
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalRunDetailRecord;
}

export async function fetchPublicEvalSamples(options?: {
  runId?: string;
  sourceCategory?: string;
  search?: string;
  minAverageWeightedScore?: number;
  maxAverageWeightedScore?: number;
  passState?: 'passed' | 'failed' | 'pending';
  limit?: number | 'all';
  offset?: number;
  includeResponses?: boolean;
}): Promise<EvalSamplesResponse> {
  const params = new URLSearchParams();
  if (options?.runId) {
    params.set('runId', options.runId);
  }
  if (options?.sourceCategory) {
    params.set('sourceCategory', options.sourceCategory);
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  if (typeof options?.minAverageWeightedScore === 'number') {
    params.set('minAverageWeightedScore', String(options.minAverageWeightedScore));
  }
  if (typeof options?.maxAverageWeightedScore === 'number') {
    params.set('maxAverageWeightedScore', String(options.maxAverageWeightedScore));
  }
  if (options?.passState) {
    params.set('passState', options.passState);
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options?.limit === 'all') {
    params.set('limit', 'all');
  }
  if (typeof options?.offset === 'number' && options.offset > 0) {
    params.set('offset', String(options.offset));
  }
  if (options?.includeResponses) {
    params.set('includeResponses', 'true');
  }

  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/public-api/evals/samples${query ? `?${query}` : ''}`,
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalSamplesResponse;
}

export async function fetchPublicEvalSampleDetail(
  runId: string,
  sampleIndex: number,
): Promise<EvalSampleRecord> {
  const response = await fetch(
    `${API_BASE_URL}/public-api/evals/samples/${encodeURIComponent(runId)}/${sampleIndex}`,
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as EvalSampleRecord;
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
