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

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function stripOsVersion(version: string | undefined): string | null {
  if (!version) return null;
  // Remove parenthetical build info: "Android 14 (API 34)" → "Android 14"
  return version.replace(/\s*\(.*\)\s*/g, '').trim() || null;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(body: TelemetryPerfBody, ip: string | null): Promise<{ accepted: boolean; reason?: string }> {
    this.logger.log(`📥 收到测评数据: soc=${body?.device?.socName} model=${body?.model?.fileName} backend=${body?.model?.backend} prefill=${body?.perf?.prefillSpeed} decode=${body?.perf?.decodeSpeed} isBatch=${body?.perf?.isBatch} batchCount=${body?.perf?.batchCount} ip=${ip}`);

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

    // Insert
    try {
      await this.prisma.telemetryPerf.create({
        data: {
          schemaVersion: body.schemaVersion ?? 1,
          installIdHash,
          socName: body.device.socName.toLowerCase().trim(),
          socBrand: body.device.socBrand?.toLowerCase().trim() ?? 'unknown',
          os: body.device.os?.toLowerCase().trim() ?? 'unknown',
          osVersion: stripOsVersion(body.device.osVersion),
          deviceModel: body.device.deviceModel?.trim() || null,
          totalMemoryMb: body.device.totalMemoryMb ?? null,
          totalVramMb: body.device.totalVramMb ?? null,
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

    this.logger.log(`✅ 已入库: soc=${body.device.socName} decode=${body.perf.decodeSpeed} backend=${body.model.backend}`);
    return { accepted: true };
  }

  async leaderboard(query: LeaderboardQuery): Promise<any[]> {
    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 500);

    const where: any = {};
    if (query.socName) where.socName = query.socName.toLowerCase().trim();
    if (query.modelSha256) where.modelSha256 = query.modelSha256.toLowerCase().trim();
    if (query.backend) where.backend = query.backend.toLowerCase().trim();
    if (query.os) where.os = query.os.toLowerCase().trim();
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    if (query.appVersion) where.appVersion = query.appVersion.trim();

    // Group by (os, modelSha256, socName, backend, isBatch) and compute aggregates
    const groups = await this.prisma.telemetryPerf.groupBy({
      by: ['os', 'modelSha256', 'modelName', 'modelFileName', 'modelSizeB', 'quantization', 'socName', 'socBrand', 'backend', 'isBatch', 'batchCount'],
      where,
      _count: { id: true },
      _max: { decodeSpeed: true, prefillSpeed: true },
      _avg: { decodeSpeed: true, prefillSpeed: true },
      orderBy: { _avg: { decodeSpeed: 'desc' } },
      take: limit,
    });

    return groups.map((group) => ({
      os: group.os,
      modelSha256: group.modelSha256,
      modelName: group.modelName,
      modelFileName: group.modelFileName,
      modelSizeB: group.modelSizeB,
      quantization: group.quantization,
      socName: group.socName,
      socBrand: group.socBrand,
      backend: group.backend,
      isBatch: group.isBatch,
      batchCount: group.batchCount,
      sampleCount: group._count.id,
      decodeSpeed: {
        avg: Math.round((group._avg.decodeSpeed ?? 0) * 100) / 100,
        max: group._max.decodeSpeed,
      },
      prefillSpeed: {
        avg: Math.round((group._avg.prefillSpeed ?? 0) * 100) / 100,
        max: group._max.prefillSpeed,
      },
    }));
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
      socName: query.socName.toLowerCase().trim(),
      modelSha256: query.modelSha256.toLowerCase().trim(),
      backend: query.backend.toLowerCase().trim(),
    };
    if (query.os) where.os = query.os.toLowerCase().trim();
    if (query.isBatch !== undefined) where.isBatch = query.isBatch === 'true';
    if (query.batchCount !== undefined) where.batchCount = Math.max(parseInt(query.batchCount, 10) || 1, 1);
    if (query.appVersion) where.appVersion = query.appVersion.trim();

    const rows = await this.prisma.telemetryPerf.findMany({
      where,
      orderBy: { decodeSpeed: 'desc' },
      take: limit,
      select: {
        id: true,
        socName: true,
        socBrand: true,
        os: true,
        osVersion: true,
        deviceModel: true,
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

    return rows;
  }
}
