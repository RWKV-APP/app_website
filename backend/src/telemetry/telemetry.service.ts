import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TELEMETRY_SALT = process.env.TELEMETRY_SALT || 'rwkv-telemetry-default-salt';

// Rate limit: max 3 records per installIdHash per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

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
  };
  clientTimestamp: number;
}

interface LeaderboardQuery {
  socName?: string;
  modelSha256?: string;
  backend?: string;
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
    // Validate required fields
    if (!body?.device?.socName || !body?.model?.sha256 || !body?.model?.backend) {
      return { accepted: false, reason: 'missing_required_fields' };
    }

    if (!body?.perf?.prefillSpeed || !body?.perf?.decodeSpeed) {
      return { accepted: false, reason: 'missing_speed' };
    }

    if (!body?.installId) {
      return { accepted: false, reason: 'missing_install_id' };
    }

    // Speed range validation
    if (body.perf.prefillSpeed <= 0 || body.perf.prefillSpeed > MAX_PREFILL_SPEED) {
      return { accepted: false, reason: 'invalid_prefill_speed' };
    }

    if (body.perf.decodeSpeed <= 0 || body.perf.decodeSpeed > MAX_DECODE_SPEED) {
      return { accepted: false, reason: 'invalid_decode_speed' };
    }

    const installIdHash = sha256(body.installId + TELEMETRY_SALT);

    // Rate limiting
    try {
      const recentCount = await this.prisma.telemetryPerf.count({
        where: {
          installIdHash,
          createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
        },
      });

      if (recentCount >= RATE_LIMIT_MAX) {
        return { accepted: false, reason: 'rate_limited' };
      }
    } catch (e) {
      this.logger.warn(`Rate limit check failed: ${e}`);
    }

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
          appVersion: body.app?.version ?? '',
          appBuild: body.app?.build ?? '',
          modelName: body.model.name ?? '',
          modelFileName: body.model.fileName ?? '',
          modelSha256: body.model.sha256.toLowerCase().trim(),
          modelSizeB: body.model.sizeB ?? null,
          quantization: body.model.quantization?.toLowerCase().trim() ?? null,
          backend: body.model.backend.toLowerCase().trim(),
          prefillSpeed: body.perf.prefillSpeed,
          decodeSpeed: body.perf.decodeSpeed,
          clientTimestamp: new Date(body.clientTimestamp ?? Date.now()),
        },
      });
    } catch (e) {
      this.logger.error(`Failed to insert telemetry: ${e}`);
      return { accepted: false, reason: 'db_error' };
    }

    return { accepted: true };
  }

  async leaderboard(query: LeaderboardQuery): Promise<any[]> {
    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 500);

    const where: any = {};
    if (query.socName) where.socName = query.socName.toLowerCase().trim();
    if (query.modelSha256) where.modelSha256 = query.modelSha256.toLowerCase().trim();
    if (query.backend) where.backend = query.backend.toLowerCase().trim();

    // Group by (modelSha256, socName, backend) and compute aggregates
    const groups = await this.prisma.telemetryPerf.groupBy({
      by: ['modelSha256', 'modelName', 'modelFileName', 'socName', 'socBrand', 'backend'],
      where,
      _count: { id: true },
      _max: { decodeSpeed: true, prefillSpeed: true },
      _avg: { decodeSpeed: true, prefillSpeed: true },
      orderBy: { _max: { decodeSpeed: 'desc' } },
      take: limit,
    });

    // For each group, compute P90 using a subquery
    const results = [];
    for (const group of groups) {
      const count = group._count.id;
      const offset = Math.max(0, Math.floor(count * 0.1));

      // P90 for decodeSpeed: the value at the 90th percentile position
      const p90Rows = await this.prisma.telemetryPerf.findMany({
        where: {
          modelSha256: group.modelSha256,
          socName: group.socName,
          backend: group.backend,
          ...where,
        },
        orderBy: { decodeSpeed: 'desc' },
        skip: offset,
        take: 1,
        select: { decodeSpeed: true, prefillSpeed: true },
      });

      results.push({
        modelSha256: group.modelSha256,
        modelName: group.modelName,
        modelFileName: group.modelFileName,
        socName: group.socName,
        socBrand: group.socBrand,
        backend: group.backend,
        sampleCount: count,
        decodeSpeed: {
          max: group._max.decodeSpeed,
          avg: Math.round((group._avg.decodeSpeed ?? 0) * 100) / 100,
          p90: p90Rows[0]?.decodeSpeed ?? group._max.decodeSpeed,
        },
        prefillSpeed: {
          max: group._max.prefillSpeed,
          avg: Math.round((group._avg.prefillSpeed ?? 0) * 100) / 100,
        },
      });
    }

    return results;
  }
}
