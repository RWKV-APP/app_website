import { BadRequestException, Injectable } from '@nestjs/common';
import { RemoteConfig, RemoteConfigActivity } from '@prisma/client';
import JSZip = require('jszip');
import { PrismaService } from '../prisma/prisma.service';
import {
  ParsedRemoteConfigUpload,
  REMOTE_CONFIG_ACTIONS,
  RemoteConfigActivitySummary,
  REMOTE_CONFIG_TYPES,
  RemoteConfigFileSummary,
  RemoteConfigType,
  RemoteConfigVersionSummary,
} from '../types/remote-config';

const APP_CONFIG_SECTIONS = ['chat', 'albatross', 'roleplay', 'world', 'tts', 'othello', 'sudoku'];

@Injectable()
export class RemoteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async listConfigFiles(): Promise<RemoteConfigFileSummary[]> {
    const records = await this.prisma.remoteConfig.findMany({
      orderBy: [{ type: 'asc' }, { effectiveBuild: 'desc' }, { createdAt: 'desc' }],
    });

    const grouped = new Map<string, RemoteConfig[]>();
    for (const record of records) {
      const key = `${record.type}:${record.fileName}`;
      const current = grouped.get(key) || [];
      current.push(record);
      grouped.set(key, current);
    }

    const result: RemoteConfigFileSummary[] = [];

    for (const versions of grouped.values()) {
      const sortedVersions = [...versions].sort((left, right) => {
        return right.createdAt.getTime() - left.createdAt.getTime();
      });
      const latestVersion = sortedVersions[0] || null;
      const publishedVersion = sortedVersions.find((item) => item.published) || null;
      const baseVersion = latestVersion || publishedVersion;
      if (!baseVersion) {
        continue;
      }

      result.push({
        type: baseVersion.type as RemoteConfigType,
        fileName: baseVersion.fileName,
        effectiveBuild: baseVersion.effectiveBuild,
        versionCount: sortedVersions.length,
        publishedVersionId: publishedVersion?.id ?? null,
        publishedVersion: publishedVersion ? this.toVersionSummary(publishedVersion) : null,
        latestVersion: latestVersion ? this.toVersionSummary(latestVersion) : null,
        versions: sortedVersions.map((item) => this.toVersionSummary(item)),
      });
    }

    return result.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }
      const leftBuild = left.effectiveBuild ?? -1;
      const rightBuild = right.effectiveBuild ?? -1;
      if (leftBuild !== rightBuild) {
        return rightBuild - leftBuild;
      }
      return left.fileName.localeCompare(right.fileName);
    });
  }

  async listActivities(limit = 40): Promise<RemoteConfigActivitySummary[]> {
    const records = await this.prisma.remoteConfigActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((record) => this.toActivitySummary(record));
  }

  async getConfigById(id: number): Promise<RemoteConfig | null> {
    return this.prisma.remoteConfig.findUnique({
      where: { id },
    });
  }

  async createVersion(input: {
    fileName: string;
    content: string;
    createdBy: string;
    publishNow?: boolean;
  }) {
    const parsedUpload = this.parseUpload({
      fileName: input.fileName,
      content: input.content,
    });

    const record = await this.prisma.remoteConfig.create({
      data: {
        type: parsedUpload.type,
        fileName: parsedUpload.fileName,
        effectiveBuild: parsedUpload.effectiveBuild,
        content: parsedUpload.normalizedContent,
        published: false,
        createdBy: input.createdBy,
      },
    });

    await this.logActivity({
      action: REMOTE_CONFIG_ACTIONS.upload,
      username: input.createdBy,
      fileName: record.fileName,
      remoteConfigId: record.id,
      detail: {
        warnings: parsedUpload.warnings,
        publishNow: input.publishNow ?? false,
      },
    });

    let activeRecord = record;
    if (input.publishNow) {
      activeRecord = await this.publishVersion(record.id, input.createdBy);
    }

    return {
      success: true,
      config: this.toVersionSummary(activeRecord),
      warnings: parsedUpload.warnings,
    };
  }

  async publishVersion(id: number, username: string): Promise<RemoteConfig> {
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await tx.remoteConfig.findUnique({
        where: { id },
      });
      if (!target) {
        throw new BadRequestException('Config not found');
      }

      const currentPublished = await tx.remoteConfig.findFirst({
        where: {
          type: target.type,
          fileName: target.fileName,
          published: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (currentPublished?.id === target.id) {
        return {
          target,
          action: REMOTE_CONFIG_ACTIONS.publish,
          previousPublishedId: currentPublished.id,
          noChange: true,
        };
      }

      await tx.remoteConfig.updateMany({
        where: {
          type: target.type,
          fileName: target.fileName,
          published: true,
        },
        data: {
          published: false,
        },
      });

      const publishedTarget = await tx.remoteConfig.update({
        where: { id: target.id },
        data: {
          published: true,
        },
      });

      const action =
        currentPublished && currentPublished.createdAt.getTime() > target.createdAt.getTime()
          ? REMOTE_CONFIG_ACTIONS.rollback
          : REMOTE_CONFIG_ACTIONS.publish;

      return {
        target: publishedTarget,
        action,
        previousPublishedId: currentPublished?.id ?? null,
        noChange: false,
      };
    });

    if (!result.noChange) {
      await this.logActivity({
        action: result.action,
        username,
        fileName: result.target.fileName,
        remoteConfigId: result.target.id,
        detail: {
          previousPublishedId: result.previousPublishedId,
        },
      });
    }

    return result.target;
  }

  async buildArchive(scope: 'all' | 'published'): Promise<{
    buffer: Buffer;
    fileName: string;
    entryCount: number;
  }> {
    const records = await this.prisma.remoteConfig.findMany({
      where: scope === 'published' ? { published: true } : undefined,
      orderBy: [{ type: 'asc' }, { fileName: 'asc' }, { createdAt: 'desc' }],
    });

    if (records.length === 0) {
      throw new BadRequestException('No configs available for archive');
    }

    const zip = new JSZip();
    const manifest = records.map((record) => ({
      id: record.id,
      type: record.type,
      fileName: record.fileName,
      effectiveBuild: record.effectiveBuild,
      published: record.published,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));

    for (const record of records) {
      const entryName =
        scope === 'published'
          ? record.fileName
          : `${record.type}/${record.fileName.replace(/\.json$/i, '')}/v${record.id}-${record.createdAt
              .toISOString()
              .replace(/[:.]/g, '-')}.json`;
      zip.file(entryName, record.content);
    }

    zip.file(
      'manifest.json',
      `${JSON.stringify(
        {
          scope,
          generatedAt: new Date().toISOString(),
          count: records.length,
          items: manifest,
        },
        null,
        2,
      )}\n`,
    );

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      buffer,
      fileName: `remote-configs-${scope}-${new Date().toISOString().slice(0, 10)}.zip`,
      entryCount: records.length,
    };
  }

  async getDemoConfigForBuild(buildNumber: number | null): Promise<RemoteConfig | null> {
    const records = await this.prisma.remoteConfig.findMany({
      where: {
        type: REMOTE_CONFIG_TYPES.appConfig,
        published: true,
      },
      orderBy: [{ effectiveBuild: 'desc' }, { createdAt: 'desc' }],
    });

    if (records.length === 0) {
      return null;
    }

    const latestFallback = records.find((record) => record.fileName === 'latest.json') ?? null;

    if (buildNumber !== null) {
      const matched = [...records]
        .filter((record) => {
          return record.effectiveBuild !== null && record.effectiveBuild >= buildNumber;
        })
        .sort((left, right) => {
          const leftBuild = left.effectiveBuild ?? Number.POSITIVE_INFINITY;
          const rightBuild = right.effectiveBuild ?? Number.POSITIVE_INFINITY;
          if (leftBuild !== rightBuild) {
            return leftBuild - rightBuild;
          }
          return right.createdAt.getTime() - left.createdAt.getTime();
        })[0];
      if (matched) {
        return matched;
      }

      if (latestFallback) {
        return latestFallback;
      }

      const highestBuildSpecific = [...records]
        .filter((record) => record.effectiveBuild !== null)
        .sort((left, right) => {
          const leftBuild = left.effectiveBuild ?? Number.NEGATIVE_INFINITY;
          const rightBuild = right.effectiveBuild ?? Number.NEGATIVE_INFINITY;
          if (leftBuild !== rightBuild) {
            return rightBuild - leftBuild;
          }
          return right.createdAt.getTime() - left.createdAt.getTime();
        })[0];
      if (highestBuildSpecific) {
        return highestBuildSpecific;
      }
    }

    if (latestFallback) {
      return latestFallback;
    }

    return records[0] ?? null;
  }

  async getSuggestionsConfig(): Promise<Record<string, unknown> | null> {
    const record = await this.prisma.remoteConfig.findFirst({
      where: {
        type: REMOTE_CONFIG_TYPES.suggestions,
        published: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return this.parseContent(record.content);
  }

  parseBuildHeader(rawBuildNumber: string | string[] | undefined): number | null {
    const raw = Array.isArray(rawBuildNumber) ? rawBuildNumber[0] : rawBuildNumber;
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  parseContent(content: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('JSON root must be an object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      throw new BadRequestException(`Invalid stored JSON: ${message}`);
    }
  }

  async logActivity(input: {
    action: string;
    username: string;
    fileName?: string | null;
    remoteConfigId?: number | null;
    detail?: Record<string, unknown> | null;
  }) {
    await this.prisma.remoteConfigActivity.create({
      data: {
        action: input.action,
        username: input.username,
        fileName: input.fileName ?? null,
        remoteConfigId: input.remoteConfigId ?? null,
        detail: input.detail ? JSON.stringify(input.detail) : null,
      },
    });
  }

  private parseUpload(input: { fileName: string; content: string }): ParsedRemoteConfigUpload {
    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new BadRequestException('File name is required');
    }

    const parsed = this.parseContent(input.content);
    const normalizedContent = `${JSON.stringify(parsed, null, 2)}\n`;

    if (fileName === 'latest.json') {
      const warnings = this.validateAppConfig(parsed, fileName);
      return {
        type: REMOTE_CONFIG_TYPES.appConfig,
        fileName,
        effectiveBuild: null,
        parsed,
        normalizedContent,
        warnings,
      };
    }

    if (fileName === 'suggestions.json') {
      const warnings = this.validateSuggestions(parsed);
      return {
        type: REMOTE_CONFIG_TYPES.suggestions,
        fileName,
        effectiveBuild: null,
        parsed,
        normalizedContent,
        warnings,
      };
    }

    const buildMatch = fileName.match(/^(\d+)\.json$/);
    if (!buildMatch) {
      throw new BadRequestException(
        'Unsupported file name. Use latest.json, suggestions.json, or {build}.json',
      );
    }

    const warnings = this.validateAppConfig(parsed, fileName);
    return {
      type: REMOTE_CONFIG_TYPES.appConfig,
      fileName,
      effectiveBuild: Number.parseInt(buildMatch[1], 10),
      parsed,
      normalizedContent,
      warnings,
    };
  }

  private validateAppConfig(parsed: Record<string, unknown>, fileName: string): string[] {
    const warnings: string[] = [];
    const presentSections = APP_CONFIG_SECTIONS.filter((section) => section in parsed);
    if (presentSections.length === 0) {
      throw new BadRequestException(
        `Invalid ${fileName}: expected at least one app config section (${APP_CONFIG_SECTIONS.join(', ')})`,
      );
    }

    let foundModelConfig = false;
    for (const sectionName of presentSections) {
      const sectionValue = parsed[sectionName];
      if (!sectionValue || Array.isArray(sectionValue) || typeof sectionValue !== 'object') {
        throw new BadRequestException(
          `Invalid ${fileName}: section "${sectionName}" must be an object`,
        );
      }

      const section = sectionValue as Record<string, unknown>;
      if (!Array.isArray(section.model_config)) {
        throw new BadRequestException(
          `Invalid ${fileName}: section "${sectionName}" is missing model_config[]`,
        );
      }
      foundModelConfig = true;

      if (sectionName !== 'chat' && 'controlled_rollout' in section) {
        warnings.push(
          `Section "${sectionName}" contains controlled_rollout but it is only used by chat.`,
        );
      }
    }

    if (!foundModelConfig) {
      throw new BadRequestException(`Invalid ${fileName}: no model_config arrays found`);
    }

    if (fileName !== 'latest.json' && !('chat' in parsed)) {
      warnings.push('Build-specific config does not contain chat section.');
    }

    return warnings;
  }

  private validateSuggestions(parsed: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    const languages = Object.keys(parsed);
    if (languages.length === 0) {
      throw new BadRequestException(
        'Invalid suggestions.json: expected at least one language block',
      );
    }

    for (const language of languages) {
      const value = parsed[language];
      if (!value || Array.isArray(value) || typeof value !== 'object') {
        throw new BadRequestException(
          `Invalid suggestions.json: language block "${language}" must be an object`,
        );
      }

      const block = value as Record<string, unknown>;
      if (!Array.isArray(block.chat)) {
        warnings.push(`Language "${language}" does not define chat suggestions.`);
      }
      if (!Array.isArray(block.tts)) {
        warnings.push(`Language "${language}" does not define tts suggestions.`);
      }
    }

    return warnings;
  }

  private toVersionSummary(record: RemoteConfig): RemoteConfigVersionSummary {
    const parsed = this.parseContent(record.content);
    return {
      id: record.id,
      type: record.type as RemoteConfigType,
      fileName: record.fileName,
      effectiveBuild: record.effectiveBuild,
      published: record.published,
      createdBy: record.createdBy ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      size: Buffer.byteLength(record.content, 'utf8'),
      topLevelKeys: Object.keys(parsed),
      modelCounts: this.extractModelCounts(parsed),
      warnings: this.getWarningsForDisplay(
        record.type as RemoteConfigType,
        record.fileName,
        parsed,
      ),
    };
  }

  private toActivitySummary(record: RemoteConfigActivity): RemoteConfigActivitySummary {
    return {
      id: record.id,
      action: record.action,
      username: record.username,
      fileName: record.fileName,
      detail: record.detail ? (JSON.parse(record.detail) as Record<string, unknown>) : null,
      remoteConfigId: record.remoteConfigId,
      createdAt: record.createdAt,
    };
  }

  private extractModelCounts(parsed: Record<string, unknown>): Record<string, number> {
    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || Array.isArray(value) || typeof value !== 'object') {
        continue;
      }

      const section = value as Record<string, unknown>;
      if (Array.isArray(section.model_config)) {
        result[key] = section.model_config.length;
      }
    }

    return result;
  }

  private getWarningsForDisplay(
    type: RemoteConfigType,
    fileName: string,
    parsed: Record<string, unknown>,
  ): string[] {
    if (type === REMOTE_CONFIG_TYPES.suggestions) {
      return this.validateSuggestions(parsed);
    }
    return this.validateAppConfig(parsed, fileName);
  }
}
