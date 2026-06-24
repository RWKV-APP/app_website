export interface TelemetrySpeedStats {
  avg: number;
  max: number | null;
  top10: number | null;
}

export interface TelemetryLeaderboardEntry {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  hardwareBrands?: string[];
  deviceModels: string[];
  deviceDisplayNames: string[];
  backend: string;
  isBatch: boolean;
  batchCount: number;
  sampleCount: number;
  decodeSpeed: TelemetrySpeedStats;
  prefillSpeed: TelemetrySpeedStats;
}

export interface TelemetryRecordEntry {
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
  clientTimestamp: string;
  createdAt: string;
}

export interface TelemetryPublicFilters {
  appVersions: string[];
  buildModes: string[];
}
