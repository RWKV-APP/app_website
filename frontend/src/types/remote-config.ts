import type { RemoteConfigType } from '@app/contracts';

export type { RemoteConfigType } from '@app/contracts';

export interface RemoteConfigVersionRecord {
  id: number;
  type: RemoteConfigType;
  fileName: string;
  effectiveBuild: number | null;
  published: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  size: number;
  topLevelKeys: string[];
  modelCounts: Record<string, number>;
  warnings: string[];
}

export interface RemoteConfigFileRecord {
  type: RemoteConfigType;
  fileName: string;
  effectiveBuild: number | null;
  versionCount: number;
  publishedVersionId: number | null;
  publishedVersion: RemoteConfigVersionRecord | null;
  latestVersion: RemoteConfigVersionRecord | null;
  versions: RemoteConfigVersionRecord[];
}

export interface RemoteConfigActivityRecord {
  id: number;
  action: string;
  username: string;
  fileName: string | null;
  detail: Record<string, unknown> | null;
  remoteConfigId: number | null;
  createdAt: string;
}

export interface UploadRemoteConfigRequest {
  fileName: string;
  content: string;
  publishNow?: boolean;
}

export interface UploadRemoteConfigResponse {
  success: boolean;
  config: RemoteConfigVersionRecord;
  warnings: string[];
}

export interface RemoteConfigVersionContentResponse {
  id: number;
  fileName: string;
  content: string;
}

export interface AdminLoginResponse {
  token: string;
  username: string;
  expiresAt: number;
}

export interface AdminSessionResponse {
  username: string;
  expiresAt: number;
}
