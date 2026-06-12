import { Request } from 'express';
import type { RemoteConfigAction, RemoteConfigType } from '@app/contracts';

export { REMOTE_CONFIG_ACTIONS, REMOTE_CONFIG_TYPES } from '@app/contracts';
export type { RemoteConfigAction, RemoteConfigType } from '@app/contracts';

export interface ParsedRemoteConfigUpload {
  type: RemoteConfigType;
  fileName: string;
  effectiveBuild: number | null;
  parsed: Record<string, unknown>;
  normalizedContent: string;
  warnings: string[];
}

export interface RemoteConfigVersionSummary {
  id: number;
  type: RemoteConfigType;
  fileName: string;
  effectiveBuild: number | null;
  published: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  topLevelKeys: string[];
  modelCounts: Record<string, number>;
  warnings: string[];
}

export interface RemoteConfigFileSummary {
  type: RemoteConfigType;
  fileName: string;
  effectiveBuild: number | null;
  versionCount: number;
  publishedVersionId: number | null;
  publishedVersion: RemoteConfigVersionSummary | null;
  latestVersion: RemoteConfigVersionSummary | null;
  versions: RemoteConfigVersionSummary[];
}

export interface RemoteConfigActivitySummary {
  id: number;
  action: RemoteConfigAction | string;
  username: string;
  fileName: string | null;
  detail: Record<string, unknown> | null;
  remoteConfigId: number | null;
  createdAt: Date;
}

export interface AdminRequest extends Request {
  adminUser?: string;
}
