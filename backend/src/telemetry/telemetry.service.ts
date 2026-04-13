import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TELEMETRY_SALT = process.env.TELEMETRY_SALT || 'rwkv-telemetry-default-salt';

// Reasonable speed bounds
const MAX_PREFILL_SPEED = 100_000;
const MAX_DECODE_SPEED = 5_000;

interface TelemetryPerfBody {
  schemaVersion: number;
  installId: string;
  device: {
    socName: string;
    socBrand: string;
    os: string;
    osVersion?: string;
    deviceModel?: string;
    cpuName?: string;
    gpuName?: string;
    totalMemoryMb?: number;
    totalVramMb?: number;
  };
  app: {
    version: string;
    build: string;
  };
  model: {
    name: string;
    fileName: string;
    sha256: string;
    sizeB?: number;
    quantization?: string;
    backend: string;
  };
  perf: {
    prefillSpeed: number;
    decodeSpeed: number;
    isBatch?: boolean;
    batchCount?: number;
  };
  clientTimestamp: number;
}

interface LeaderboardQuery {
  socName?: string;
  modelSha256?: string;
  backend?: string;
  os?: string;
  isBatch?: string;
  appVersion?: string;
  limit?: string;
}

interface RecordsQuery {
  socName: string;
  modelSha256: string;
  backend: string;
  isBatch?: string;
  batchCount?: string;
  os?: string;
  appVersion?: string;
  limit?: string;
}

interface LeaderboardAccumulator {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  deviceModelCounts: Map<string, number>;
  sampleCount: number;
  decodeValues: number[];
  prefillValues: number[];
  decodeTotal: number;
  prefillTotal: number;
  decodeMax: number | null;
  prefillMax: number | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function leaderboardGroupKey(input: {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
}): string {
  return [
    input.os,
    input.modelSha256,
    input.modelName,
    input.modelFileName,
    input.modelSizeB ?? '',
    input.quantization ?? '',
    input.socName,
    input.socBrand,
    input.backend,
    input.isBatch ? '1' : '0',
    input.batchCount,
  ].join('\u0001');
}

function roundSpeed(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

function pickTopDecileValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => b - a);
  // 样本少于 10 条时，这里会自然回到第 1 名，也就是当前可见的最高分。
  const index = Math.max(0, Math.ceil(sorted.length * 0.1) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? null;
}

function stripOsVersion(version: string | undefined): string | null {
  if (!version) return null;
  // Remove parenthetical build info: "Android 14 (API 34)" → "Android 14"
  return version.replace(/\s*\(.*\)\s*/g, '').trim() || null;
}

interface TelemetryDeviceAlias {
  socBrand: string;
  cpuName?: string;
  gpuName?: string;
}

interface TelemetryDeviceInput {
  socName?: string | null;
  socBrand?: string | null;
  os?: string | null;
  osVersion?: string | null;
  deviceModel?: string | null;
  cpuName?: string | null;
  gpuName?: string | null;
  totalMemoryMb?: number | null;
  totalVramMb?: number | null;
}

interface NormalizedTelemetryDevice {
  socName: string;
  socNameKey: string;
  socBrand: string;
  os: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
}

interface TelemetryLeaderboardRow {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  prefillSpeed: number;
  decodeSpeed: number;
}

interface TelemetryRecordRow extends TelemetryLeaderboardRow {
  id: number;
  appVersion: string;
  appBuild: string;
  clientTimestamp: Date;
  createdAt: Date;
}

interface NormalizedTelemetryLeaderboardRow extends TelemetryLeaderboardRow {
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  socNameKey: string;
}

interface NormalizedTelemetryRecordRow extends TelemetryRecordRow {
  socName: string;
  socBrand: string;
  osVersion: string | null;
  deviceModel: string | null;
  cpuName: string | null;
  gpuName: string | null;
  socNameKey: string;
}

const TELEMETRY_DEVICE_ALIASES: Record<string, TelemetryDeviceAlias> = {
  'windows 11 home china': {
    socBrand: 'intel',
    cpuName: 'Intel(R) Core(TM) Ultra X7 358H',
    gpuName: 'Intel(R) Arc(TM) B390 GPU',
  },
  '(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
  'amd radeon(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
  'radeon(tm) 8060s graphics': {
    socBrand: 'amd',
    cpuName: 'AMD Ryzen AI Max+ 395 w/ Radeon 8060S',
    gpuName: 'AMD Radeon(TM) 8060S Graphics',
  },
};

function cleanOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLookupKey(value: string | null | undefined): string {
  return cleanOptionalString(value)?.toLowerCase() ?? '';
}

function normalizeBrand(value: string | null | undefined): string {
  const key = normalizeLookupKey(value);
  if (!key || key === 'unknown') return 'unknown';
  if (key === 'qualcomm') return 'snapdragon';
  return key;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function inferBrandFromHardware(values: Array<string | null | undefined>): string {
  const combined = values
    .map((value) => normalizeLookupKey(value))
    .filter((value) => value.length > 0)
    .join(' ');

  if (!combined) return 'unknown';
  if (
    combined.includes('snapdragon') ||
    combined.includes('qualcomm') ||
    combined.includes('x elite')
  ) {
    return 'snapdragon';
  }
  if (
    combined.includes('nvidia') ||
    combined.includes('rtx ') ||
    combined.includes('gtx ') ||
    combined.includes('geforce')
  ) {
    return 'nvidia';
  }
  if (combined.includes('amd') || combined.includes('radeon') || combined.includes('ryzen')) {
    return 'amd';
  }
  if (combined.includes('intel') || combined.includes(' arc')) {
    return 'intel';
  }
  if (combined.includes('apple') || /\bm[1-4]\b/.test(combined)) {
    return 'apple';
  }
  if (
    combined.includes('mediatek') ||
    combined.includes('dimensity') ||
    combined.includes('helio')
  ) {
    return 'mediatek';
  }
  if (combined.includes('samsung') || combined.includes('exynos')) {
    return 'samsung';
  }
  return 'unknown';
}

function isGenericSocName(value: string | null | undefined, os: string): boolean {
  const key = normalizeLookupKey(value);
  if (!key || key === 'unknown') return true;
  if (key === os) return true;
  if (key.startsWith('windows ')) return true;
  if (key === 'windows') return true;
  if (key.startsWith('linux')) return true;
  if (key.startsWith('ubuntu')) return true;
  if (key.startsWith('macos')) return true;
  if (key === 'android') return true;
  if (key === 'ios') return true;
  return false;
}

function shouldPreferGpuAsSocName(backend: string | null | undefined): boolean {
  return normalizeLookupKey(backend) === 'webrwkv';
}

function findTelemetryDeviceAlias(device: {
  socName?: string | null;
  deviceModel?: string | null;
  cpuName?: string | null;
  gpuName?: string | null;
}): TelemetryDeviceAlias | null {
  const keys = [
    normalizeLookupKey(device.socName),
    normalizeLookupKey(device.deviceModel),
    normalizeLookupKey(device.cpuName),
    normalizeLookupKey(device.gpuName),
  ];

  for (const key of keys) {
    if (!key) continue;
    const alias = TELEMETRY_DEVICE_ALIASES[key];
    if (alias) return alias;
  }

  return null;
}

function normalizeTelemetryDevice(
  device: TelemetryDeviceInput,
  backend: string | null | undefined,
): NormalizedTelemetryDevice {
  const rawSocName = cleanOptionalString(device.socName);
  const os = normalizeLookupKey(device.os) || 'unknown';
  const alias = findTelemetryDeviceAlias(device);
  const cpuName = cleanOptionalString(device.cpuName) ?? alias?.cpuName ?? null;
  const gpuName = cleanOptionalString(device.gpuName) ?? alias?.gpuName ?? null;
  const deviceModel = cleanOptionalString(device.deviceModel);
  const normalizedBrandFromInput = normalizeBrand(device.socBrand);

  let socBrand = normalizedBrandFromInput;
  if (socBrand === 'unknown' && alias) {
    socBrand = alias.socBrand;
  }
  if (socBrand === 'unknown') {
    socBrand = inferBrandFromHardware([gpuName, cpuName, rawSocName, deviceModel]);
  }

  let canonicalSocName = rawSocName;
  if (shouldPreferGpuAsSocName(backend) && gpuName) {
    canonicalSocName = gpuName;
  } else if (isGenericSocName(canonicalSocName, os)) {
    canonicalSocName = shouldPreferGpuAsSocName(backend)
      ? (gpuName ?? cpuName ?? canonicalSocName)
      : (cpuName ?? gpuName ?? canonicalSocName);
  } else if (
    !shouldPreferGpuAsSocName(backend) &&
    cpuName &&
    normalizeLookupKey(canonicalSocName) === normalizeLookupKey(gpuName)
  ) {
    canonicalSocName = cpuName;
  } else if (
    alias?.gpuName &&
    normalizeLookupKey(rawSocName) === normalizeLookupKey(alias.gpuName)
  ) {
    canonicalSocName = alias.gpuName;
  } else if (alias?.gpuName && shouldPreferGpuAsSocName(backend)) {
    canonicalSocName = alias.gpuName;
  }

  if (!canonicalSocName) {
    canonicalSocName = gpuName ?? cpuName ?? deviceModel ?? rawSocName ?? os;
  }

  const osVersion = stripOsVersion(cleanOptionalString(device.osVersion) ?? undefined);

  return {
    socName: canonicalSocName,
    socNameKey: normalizeLookupKey(canonicalSocName),
    socBrand,
    os,
    osVersion,
    deviceModel,
    cpuName,
    gpuName,
    totalMemoryMb: normalizeNullableNumber(device.totalMemoryMb),
    totalVramMb: normalizeNullableNumber(device.totalVramMb),
  };
}

function normalizeTelemetryLeaderboardRow(
  row: TelemetryLeaderboardRow,
): NormalizedTelemetryLeaderboardRow {
  const normalized = normalizeTelemetryDevice(row, row.backend);
  return {
    ...row,
    ...normalized,
  };
}

function normalizeTelemetryRecordRow(row: TelemetryRecordRow): NormalizedTelemetryRecordRow {
  const normalized = normalizeTelemetryDevice(row, row.backend);
  return {
    ...row,
    ...normalized,
  };
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    body: TelemetryPerfBody,
    ip: string | null,
  ): Promise<{ accepted: boolean; reason?: string }> {
    this.logger.log(
      `📥 收到测评数据: soc=${body?.device?.socName} model=${body?.model?.fileName} backend=${body?.model?.backend} prefill=${body?.perf?.prefillSpeed} decode=${body?.perf?.decodeSpeed} isBatch=${body?.perf?.isBatch} batchCount=${body?.perf?.batchCount} ip=${ip}`,
    );

    // Validate required fields (sha256 is optional — fileName serves as fallback identifier)
    if (!body?.device?.socName || !body?.model?.backend) {
      this.logger.warn('❌ 拒绝: missing_required_fields');
      return { accepted: false, reason: 'missing_required_fields' };
    }

    if (!body?.perf?.prefillSpeed || !body?.perf?.decodeSpeed) {
      this.logger.warn('❌ 拒绝: missing_speed');
      return { accepted: false, reason: 'missing_speed' };
    }

    if (!body?.installId) {
      this.logger.warn('❌ 拒绝: missing_install_id');
      return { accepted: false, reason: 'missing_install_id' };
    }

    // Speed range validation
    if (body.perf.prefillSpeed <= 0 || body.perf.prefillSpeed > MAX_PREFILL_SPEED) {
      this.logger.warn(`❌ 拒绝: invalid_prefill_speed (${body.perf.prefillSpeed})`);
      return { accepted: false, reason: 'invalid_prefill_speed' };
    }

    if (body.perf.decodeSpeed <= 0 || body.perf.decodeSpeed > MAX_DECODE_SPEED) {
      this.logger.warn(`❌ 拒绝: invalid_decode_speed (${body.perf.decodeSpeed})`);
      return { accepted: false, reason: 'invalid_decode_speed' };
    }

    const installIdHash = sha256(body.installId + TELEMETRY_SALT);
    const normalizedDevice = normalizeTelemetryDevice(
      {
        ...body.device,
      },
      body.model?.backend,
    );

    // Insert
    try {
      await this.prisma.telemetryPerf.create({
        data: {
          schemaVersion: body.schemaVersion ?? 1,
          installIdHash,
          socName: normalizedDevice.socNameKey,
          socBrand: normalizedDevice.socBrand,
          os: normalizedDevice.os,
          osVersion: normalizedDevice.osVersion,
          deviceModel: normalizedDevice.deviceModel,
          cpuName: normalizedDevice.cpuName,
          gpuName: normalizedDevice.gpuName,
          totalMemoryMb: normalizedDevice.totalMemoryMb,
          totalVramMb: normalizedDevice.totalVramMb,
          appVersion: body.app?.version ?? '',
          appBuild: body.app?.build ?? '',
          modelName: body.model.name ?? '',
          modelFileName: body.model.fileName ?? '',
          modelSha256: (body.model.sha256 || body.model.fileName || '').toLowerCase().trim(),
          modelSizeB: body.model.sizeB ?? null,
          quantization: body.model.quantization?.toLowerCase().trim() ?? null,
          backend: body.model.backend.toLowerCase().trim(),
          isBatch: body.perf.isBatch === true,
          batchCount: body.perf.batchCount ?? 1,
          prefillSpeed: body.perf.prefillSpeed,
          decodeSpeed: body.perf.decodeSpeed,
          clientTimestamp: new Date(body.clientTimestamp ?? Date.now()),
        },
      });
    } catch (e) {
      this.logger.error(`❌ 写入失败: ${e}`);
      return { accepted: false, reason: 'db_error' };
    }

    this.logger.log(
      `✅ 已入库: soc=${body.device.socName} decode=${body.perf.decodeSpeed} backend=${body.model.backend}`,
    );
    return { accepted: true };
  }

  async leaderboard(query: LeaderboardQuery): Promise<any[]> {
    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 5000);

    const where: any = {};
    if (query.modelSha256) where.modelSha256 = query.modelSha256.toLowerCase().trim();
    if (query.backend) where.backend = query.backend.toLowerCase().trim();
    if (query.os) where.os = query.os.toLowerCase().trim();
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    if (query.appVersion) where.appVersion = query.appVersion.trim();

    const rows = await this.prisma.telemetryPerf.findMany({
      where,
      select: {
        os: true,
        modelSha256: true,
        modelName: true,
        modelFileName: true,
        modelSizeB: true,
        quantization: true,
        socName: true,
        socBrand: true,
        osVersion: true,
        deviceModel: true,
        cpuName: true,
        gpuName: true,
        totalMemoryMb: true,
        totalVramMb: true,
        backend: true,
        isBatch: true,
        batchCount: true,
        decodeSpeed: true,
        prefillSpeed: true,
      },
    });

    const querySocNameKey = normalizeLookupKey(query.socName);
    const groups = new Map<string, LeaderboardAccumulator>();
    for (const rawRow of rows) {
      const row = normalizeTelemetryLeaderboardRow(rawRow);
      if (querySocNameKey && row.socNameKey !== querySocNameKey) {
        continue;
      }

      const key = leaderboardGroupKey(row);
      const existing = groups.get(key);
      if (existing) {
        existing.sampleCount += 1;
        if (row.deviceModel) {
          existing.deviceModelCounts.set(
            row.deviceModel,
            (existing.deviceModelCounts.get(row.deviceModel) ?? 0) + 1,
          );
        }
        existing.decodeValues.push(row.decodeSpeed);
        existing.prefillValues.push(row.prefillSpeed);
        existing.decodeTotal += row.decodeSpeed;
        existing.prefillTotal += row.prefillSpeed;
        existing.decodeMax = existing.decodeMax === null ? row.decodeSpeed : Math.max(existing.decodeMax, row.decodeSpeed);
        existing.prefillMax = existing.prefillMax === null ? row.prefillSpeed : Math.max(existing.prefillMax, row.prefillSpeed);
        continue;
      }

      groups.set(key, {
        os: row.os,
        modelSha256: row.modelSha256,
        modelName: row.modelName,
        modelFileName: row.modelFileName,
        modelSizeB: row.modelSizeB,
        quantization: row.quantization,
        socName: row.socName,
        socBrand: row.socBrand,
        backend: row.backend,
        isBatch: row.isBatch,
        batchCount: row.batchCount,
        deviceModelCounts: row.deviceModel ? new Map([[row.deviceModel, 1]]) : new Map(),
        sampleCount: 1,
        decodeValues: [row.decodeSpeed],
        prefillValues: [row.prefillSpeed],
        decodeTotal: row.decodeSpeed,
        prefillTotal: row.prefillSpeed,
        decodeMax: row.decodeSpeed,
        prefillMax: row.prefillSpeed,
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        os: group.os,
        modelSha256: group.modelSha256,
        modelName: group.modelName,
        modelFileName: group.modelFileName,
        modelSizeB: group.modelSizeB,
        quantization: group.quantization,
        socName: group.socName,
        socBrand: group.socBrand,
        deviceModels: Array.from(group.deviceModelCounts.entries())
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .map(([deviceModel]) => deviceModel),
        backend: group.backend,
        isBatch: group.isBatch,
        batchCount: group.batchCount,
        sampleCount: group.sampleCount,
        decodeSpeed: {
          avg: roundSpeed(group.decodeTotal / group.sampleCount) ?? 0,
          max: roundSpeed(group.decodeMax),
          top10: roundSpeed(pickTopDecileValue(group.decodeValues)),
        },
        prefillSpeed: {
          avg: roundSpeed(group.prefillTotal / group.sampleCount) ?? 0,
          max: roundSpeed(group.prefillMax),
          top10: roundSpeed(pickTopDecileValue(group.prefillValues)),
        },
      }))
      .sort((a, b) => {
        const top10Diff = (b.decodeSpeed.top10 ?? b.decodeSpeed.avg) - (a.decodeSpeed.top10 ?? a.decodeSpeed.avg);
        if (top10Diff !== 0) return top10Diff;
        const avgDiff = b.decodeSpeed.avg - a.decodeSpeed.avg;
        if (avgDiff !== 0) return avgDiff;
        return b.sampleCount - a.sampleCount;
      })
      .slice(0, limit);
  }

  async filters(): Promise<{ appVersions: string[] }> {
    const versions = await this.prisma.telemetryPerf.groupBy({
      by: ['appVersion'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const appVersions = versions
      .map((v) => v.appVersion)
      .filter((v) => v && v.length > 0)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return { appVersions };
  }

  async records(query: RecordsQuery): Promise<any[]> {
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 200);

    const where: any = {
      modelSha256: query.modelSha256.toLowerCase().trim(),
      backend: query.backend.toLowerCase().trim(),
    };
    if (query.os) where.os = query.os.toLowerCase().trim();
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    if (query.batchCount !== undefined) where.batchCount = Math.max(parseInt(query.batchCount, 10) || 1, 1);
    if (query.appVersion) where.appVersion = query.appVersion.trim();

    const rows = await this.prisma.telemetryPerf.findMany({
      where,
      select: {
        id: true,
        socName: true,
        socBrand: true,
        os: true,
        osVersion: true,
        deviceModel: true,
        cpuName: true,
        gpuName: true,
        totalMemoryMb: true,
        totalVramMb: true,
        appVersion: true,
        appBuild: true,
        modelName: true,
        modelFileName: true,
        modelSha256: true,
        modelSizeB: true,
        quantization: true,
        backend: true,
        isBatch: true,
        batchCount: true,
        prefillSpeed: true,
        decodeSpeed: true,
        clientTimestamp: true,
        createdAt: true,
      },
    });

    const querySocNameKey = normalizeLookupKey(query.socName);

    return rows
      .map((row) => normalizeTelemetryRecordRow(row))
      .filter((row) => row.socNameKey === querySocNameKey)
      .sort((left, right) => right.decodeSpeed - left.decodeSpeed)
      .slice(0, limit)
      .map(({ socNameKey, ...row }) => row);
  }
}
