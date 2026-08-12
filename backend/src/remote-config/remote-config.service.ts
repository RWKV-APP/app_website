import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { RemoteConfig, RemoteConfigActivity } from '@prisma/client';
import JSZip = require('jszip');
import { APP_CONFIG_SECTIONS } from '@app/contracts';
import { Config } from '../config';
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

const HUGGING_FACE_HOSTS = new Set(['huggingface.co', 'www.huggingface.co']);
const HUGGING_FACE_USER_AGENT = 'RWKV-App-Website/1.0';
const HUGGING_FACE_TREE_PAGE_SIZE = 100;
const HUGGING_FACE_MAX_TREE_PAGES = 20;
const MODELSCOPE_USER_AGENT = HUGGING_FACE_USER_AGENT;

interface ModelRepositoryMirror {
  huggingFaceRepoId: string;
  huggingFaceRevision: string;
  modelScopeRepoId: string;
  modelScopeRevision: string;
}

const MODEL_REPOSITORY_MIRRORS: ModelRepositoryMirror[] = [
  {
    huggingFaceRepoId: 'HaloWang/rwkv-weights',
    huggingFaceRevision: 'main',
    modelScopeRepoId: 'HaloWang1991/rwkv-weights',
    modelScopeRevision: 'master',
  },
  {
    huggingFaceRepoId: 'mollysama/rwkv-mobile-models',
    huggingFaceRevision: 'main',
    modelScopeRepoId: 'RWKV/rwkv-mobile-models',
    modelScopeRevision: 'master',
  },
];

interface HuggingFaceResolveTarget {
  repoId: string;
  revision: string;
  filePath: string;
}

interface HuggingFaceTreeEntry {
  path?: string;
  type?: string;
  size?: number;
  lfs?: {
    oid?: string;
    size?: number;
  };
  lastCommit?: {
    date?: string;
  };
}

interface HuggingFaceFileMetadata {
  size: number;
  timestamp: number;
  sha256: string | null;
}

interface ModelScopeResolveTarget {
  repoId: string;
  revision: string;
  filePath: string;
}

interface ModelScopeFileMetadata {
  size: number;
  timestamp: number;
  sha256: string;
}

interface ModelConfigLocation {
  fileName: string;
  sectionName: string;
  modelIndex: number;
}

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
    const parsedUpload = await this.parseUpload({
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

  private async parseUpload(input: {
    fileName: string;
    content: string;
  }): Promise<ParsedRemoteConfigUpload> {
    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new BadRequestException('File name is required');
    }

    const parsed = this.parseContent(input.content);

    if (fileName === 'latest.json') {
      const warnings = this.validateAppConfig(parsed, fileName);
      warnings.push(...(await this.syncAppConfigRepositoryMetadata(parsed, fileName)));
      const normalizedContent = `${JSON.stringify(parsed, null, 2)}\n`;
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
      const normalizedContent = `${JSON.stringify(parsed, null, 2)}\n`;
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
    warnings.push(...(await this.syncAppConfigRepositoryMetadata(parsed, fileName)));
    const normalizedContent = `${JSON.stringify(parsed, null, 2)}\n`;
    return {
      type: REMOTE_CONFIG_TYPES.appConfig,
      fileName,
      effectiveBuild: Number.parseInt(buildMatch[1], 10),
      parsed,
      normalizedContent,
      warnings,
    };
  }

  private async syncAppConfigRepositoryMetadata(
    parsed: Record<string, unknown>,
    fileName: string,
  ): Promise<string[]> {
    const huggingFaceTreeCache = new Map<string, Promise<HuggingFaceTreeEntry[]>>();
    const huggingFaceMetadataCache = new Map<string, Promise<HuggingFaceFileMetadata>>();
    const modelScopeMetadataCache = new Map<string, Promise<ModelScopeFileMetadata>>();
    let synchronizedModelCount = 0;
    const warnings: string[] = [];

    for (const sectionName of APP_CONFIG_SECTIONS.filter((section) => section in parsed)) {
      const sectionValue = parsed[sectionName];
      if (!sectionValue || Array.isArray(sectionValue) || typeof sectionValue !== 'object') {
        continue;
      }

      const section = sectionValue as Record<string, unknown>;
      const modelConfig = section.model_config;
      if (!Array.isArray(modelConfig)) {
        continue;
      }

      for (let index = 0; index < modelConfig.length; index++) {
        const modelValue = modelConfig[index];
        if (!modelValue || Array.isArray(modelValue) || typeof modelValue !== 'object') {
          throw new BadRequestException(
            `Invalid ${fileName}: section "${sectionName}" model_config[${index}] must be an object`,
          );
        }

        const model = modelValue as Record<string, unknown>;
        const rawUrl = model.url;
        if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
          throw new BadRequestException(
            `Upload blocked: ${fileName} section "${sectionName}" model_config[${index}] is missing a Hugging Face resolve URL that can be mapped to ModelScope.`,
          );
        }

        const normalizedUrl = rawUrl.trim();
        const huggingFaceTarget = this.parseHuggingFaceResolveUrl(normalizedUrl);
        if (!huggingFaceTarget) {
          throw new BadRequestException(
            `Upload blocked: ${fileName} section "${sectionName}" model_config[${index}] must use a Hugging Face resolve URL. Received: ${normalizedUrl}`,
          );
        }
        const modelScopeTarget = this.resolveModelScopeTarget(huggingFaceTarget, {
          fileName,
          sectionName,
          modelIndex: index,
        });

        let huggingFaceMetadata: HuggingFaceFileMetadata;
        let modelScopeMetadata: ModelScopeFileMetadata;
        try {
          [huggingFaceMetadata, modelScopeMetadata] = await Promise.all([
            this.getHuggingFaceFileMetadata(normalizedUrl, {
              fileName,
              sectionName,
              modelIndex: index,
              treeCache: huggingFaceTreeCache,
              metadataCache: huggingFaceMetadataCache,
            }),
            this.getModelScopeFileMetadata(modelScopeTarget, {
              fileName,
              sectionName,
              modelIndex: index,
              metadataCache: modelScopeMetadataCache,
            }),
          ]);
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }

          throw new BadRequestException(
            `Upload blocked: concurrent Hugging Face and ModelScope validation could not complete for ${fileName} section "${sectionName}" model_config[${index}]: ${this.formatRepositoryValidationError(error)}.`,
          );
        }

        this.assertMirroredFileMetadata(
          normalizedUrl,
          model,
          huggingFaceTarget,
          huggingFaceMetadata,
          modelScopeTarget,
          modelScopeMetadata,
          { fileName, sectionName, modelIndex: index },
        );

        let updated = false;
        if (model.fileSize !== huggingFaceMetadata.size) {
          model.fileSize = huggingFaceMetadata.size;
          updated = true;
        }

        if (model.date !== huggingFaceMetadata.timestamp) {
          model.date = huggingFaceMetadata.timestamp;
          updated = true;
        }

        if (updated) {
          synchronizedModelCount++;
        }
      }
    }

    if (synchronizedModelCount > 0) {
      warnings.unshift(
        `Synced dual-source-verified fileSize and Hugging Face date for ${synchronizedModelCount} model entr${
          synchronizedModelCount === 1 ? 'y' : 'ies'
        }.`,
      );
    }

    return warnings;
  }

  private formatRepositoryValidationError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const details = [error.code, error.response?.status ? `HTTP ${error.response.status}` : '']
        .filter(Boolean)
        .join(', ');
      return details ? `${error.message} (${details})` : error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown metadata request error';
  }

  private resolveModelScopeTarget(
    huggingFaceTarget: HuggingFaceResolveTarget,
    location: ModelConfigLocation,
  ): ModelScopeResolveTarget {
    const mirror = MODEL_REPOSITORY_MIRRORS.find(
      (candidate) =>
        candidate.huggingFaceRepoId.toLowerCase() === huggingFaceTarget.repoId.toLowerCase() &&
        candidate.huggingFaceRevision === huggingFaceTarget.revision,
    );

    if (!mirror) {
      const supportedRepositories = MODEL_REPOSITORY_MIRRORS.map(
        (candidate) =>
          `${candidate.huggingFaceRepoId}@${candidate.huggingFaceRevision} -> ${candidate.modelScopeRepoId}@${candidate.modelScopeRevision}`,
      ).join(', ');
      throw new BadRequestException(
        `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] uses ${huggingFaceTarget.repoId}@${huggingFaceTarget.revision}, which has no approved ModelScope mirror. Supported mappings: ${supportedRepositories}.`,
      );
    }

    return {
      repoId: mirror.modelScopeRepoId,
      revision: mirror.modelScopeRevision,
      filePath: huggingFaceTarget.filePath,
    };
  }

  private assertMirroredFileMetadata(
    rawUrl: string,
    model: Record<string, unknown>,
    huggingFaceTarget: HuggingFaceResolveTarget,
    huggingFaceMetadata: HuggingFaceFileMetadata,
    modelScopeTarget: ModelScopeResolveTarget,
    modelScopeMetadata: ModelScopeFileMetadata,
    location: ModelConfigLocation,
  ): void {
    const modelScopeUrl = this.buildModelScopeResolveUrl(modelScopeTarget);
    if (huggingFaceMetadata.size !== modelScopeMetadata.size) {
      throw new BadRequestException(
        `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] has different file sizes on Hugging Face and ModelScope (${huggingFaceMetadata.size} vs ${modelScopeMetadata.size}). Hugging Face: ${rawUrl}; ModelScope: ${modelScopeUrl}`,
      );
    }

    if (!huggingFaceMetadata.sha256) {
      throw new BadRequestException(
        `Upload blocked: Hugging Face did not return a SHA-256 digest for ${huggingFaceTarget.repoId}@${huggingFaceTarget.revision}/${huggingFaceTarget.filePath}.`,
      );
    }

    if (huggingFaceMetadata.sha256 !== modelScopeMetadata.sha256) {
      throw new BadRequestException(
        `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] has different SHA-256 digests on Hugging Face and ModelScope (${huggingFaceMetadata.sha256} vs ${modelScopeMetadata.sha256}).`,
      );
    }

    if (model.sha256 !== undefined) {
      const catalogSha256 = this.normalizeSha256(model.sha256);
      if (!catalogSha256) {
        throw new BadRequestException(
          `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] has an invalid sha256 value.`,
        );
      }
      if (catalogSha256 !== huggingFaceMetadata.sha256) {
        throw new BadRequestException(
          `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] sha256 does not match the byte-identical Hugging Face and ModelScope files.`,
        );
      }
    }
  }

  private async getModelScopeFileMetadata(
    target: ModelScopeResolveTarget,
    input: ModelConfigLocation & {
      metadataCache: Map<string, Promise<ModelScopeFileMetadata>>;
    },
  ): Promise<ModelScopeFileMetadata> {
    const cacheKey = `${target.repoId}@${target.revision}/${target.filePath}`;
    let cachedMetadata = input.metadataCache.get(cacheKey);
    if (cachedMetadata === undefined) {
      cachedMetadata = this.resolveModelScopeFileMetadata(target, input);
      input.metadataCache.set(cacheKey, cachedMetadata);
    }

    return cachedMetadata;
  }

  private async resolveModelScopeFileMetadata(
    target: ModelScopeResolveTarget,
    location: ModelConfigLocation,
  ): Promise<ModelScopeFileMetadata> {
    const resolveUrl = this.buildModelScopeResolveUrl(target);
    const response = await axios.get<ArrayBuffer>(resolveUrl, {
      headers: {
        'User-Agent': MODELSCOPE_USER_AGENT,
        Range: 'bytes=0-0',
      },
      timeout: 30000,
      maxRedirects: 5,
      maxContentLength: 1024,
      maxBodyLength: 1024,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    if (response.status === 404) {
      throw new BadRequestException(
        `Upload blocked: ${location.fileName} section "${location.sectionName}" model_config[${location.modelIndex}] points to a non-existent ModelScope file: ${resolveUrl}`,
      );
    }

    if (response.status !== 206) {
      throw new BadRequestException(
        `Upload blocked: ModelScope validation failed with status ${response.status} while checking ${target.repoId}@${target.revision}/${target.filePath}.`,
      );
    }

    const contentRange = this.readHeaderValue(response.headers['content-range']);
    const totalSizeMatch = typeof contentRange === 'string' ? contentRange.match(/\/(\d+)$/) : null;
    const size = totalSizeMatch ? Number.parseInt(totalSizeMatch[1], 10) : 0;
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException(
        `Upload blocked: ModelScope did not return a usable file size for ${resolveUrl}.`,
      );
    }

    const sha256 = this.normalizeSha256(this.readHeaderValue(response.headers['x-linked-etag']));
    if (!sha256) {
      throw new BadRequestException(
        `Upload blocked: ModelScope did not return a SHA-256 digest for ${resolveUrl}.`,
      );
    }

    const lastModified = this.readHeaderValue(response.headers['last-modified']);
    return {
      size,
      timestamp: this.parseDateToUnixTimestamp(lastModified),
      sha256,
    };
  }

  private buildModelScopeResolveUrl(target: ModelScopeResolveTarget): string {
    const filePath = target.filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.getModelScopeBaseEndpoint()}/models/${target.repoId}/resolve/${encodeURIComponent(target.revision)}/${filePath}`;
  }

  private normalizeSha256(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '').toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
  }

  private readHeaderValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return this.readHeaderValue(value[0]);
    }

    return undefined;
  }

  private async getHuggingFaceFileMetadata(
    rawUrl: string,
    input: {
      fileName: string;
      sectionName: string;
      modelIndex: number;
      treeCache: Map<string, Promise<HuggingFaceTreeEntry[]>>;
      metadataCache: Map<string, Promise<HuggingFaceFileMetadata>>;
    },
  ): Promise<HuggingFaceFileMetadata> {
    const cacheKey = rawUrl;
    let cachedMetadata = input.metadataCache.get(cacheKey);
    if (cachedMetadata === undefined) {
      cachedMetadata = this.resolveHuggingFaceFileMetadata(rawUrl, input);
      input.metadataCache.set(cacheKey, cachedMetadata);
    }

    return cachedMetadata;
  }

  private async resolveHuggingFaceFileMetadata(
    rawUrl: string,
    input: {
      fileName: string;
      sectionName: string;
      modelIndex: number;
      treeCache: Map<string, Promise<HuggingFaceTreeEntry[]>>;
    },
  ): Promise<HuggingFaceFileMetadata> {
    const target = this.parseHuggingFaceResolveUrl(rawUrl);
    if (!target) {
      throw new BadRequestException(
        `Upload blocked: ${input.fileName} section "${input.sectionName}" model_config[${input.modelIndex}] must use a Hugging Face resolve URL. Received: ${rawUrl}`,
      );
    }

    const treeEntries = await this.getOrFetchHuggingFaceTreeEntries(target, input.treeCache);
    const exactMatch = treeEntries.find(
      (entry) => entry.type === 'file' && entry.path === target.filePath,
    );

    if (!exactMatch) {
      throw new BadRequestException(
        `Upload blocked: ${input.fileName} section "${input.sectionName}" model_config[${input.modelIndex}] points to a non-existent Hugging Face file. Fix the file name/path and upload again: ${rawUrl}`,
      );
    }

    let size = typeof exactMatch.size === 'number' ? exactMatch.size : 0;
    let timestamp = this.parseDateToUnixTimestamp(exactMatch.lastCommit?.date);
    let sha256 = this.normalizeSha256(exactMatch.lfs?.oid);

    if (size <= 0 || timestamp <= 0 || !sha256) {
      const fallbackMetadata = await this.fetchHuggingFaceHeadMetadata(target);
      if (size <= 0) {
        size = fallbackMetadata.size;
      }
      if (timestamp <= 0) {
        timestamp = fallbackMetadata.timestamp;
      }
      if (!sha256) {
        sha256 = fallbackMetadata.sha256;
      }
    }

    if (size <= 0) {
      throw new BadRequestException(
        `Upload blocked: Hugging Face did not return a usable file size for ${rawUrl}.`,
      );
    }

    if (timestamp <= 0) {
      throw new BadRequestException(
        `Upload blocked: Hugging Face did not return a usable last-updated time for ${rawUrl}.`,
      );
    }

    return { size, timestamp, sha256 };
  }

  private async getOrFetchHuggingFaceTreeEntries(
    target: HuggingFaceResolveTarget,
    treeCache: Map<string, Promise<HuggingFaceTreeEntry[]>>,
  ): Promise<HuggingFaceTreeEntry[]> {
    const directoryPath = target.filePath.includes('/')
      ? target.filePath.slice(0, target.filePath.lastIndexOf('/'))
      : '';
    const cacheKey = `${target.repoId}@${target.revision}:${directoryPath}`;

    let cachedEntries = treeCache.get(cacheKey);
    if (cachedEntries === undefined) {
      cachedEntries = this.fetchHuggingFaceTreeEntries(
        target.repoId,
        target.revision,
        directoryPath,
      );
      treeCache.set(cacheKey, cachedEntries);
    }

    return cachedEntries;
  }

  private async fetchHuggingFaceTreeEntries(
    repoId: string,
    revision: string,
    directoryPath: string,
  ): Promise<HuggingFaceTreeEntry[]> {
    const entries: HuggingFaceTreeEntry[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;

    for (let page = 0; page < HUGGING_FACE_MAX_TREE_PAGES; page++) {
      const params = new URLSearchParams({
        recursive: 'false',
        expand: 'true',
        limit: HUGGING_FACE_TREE_PAGE_SIZE.toString(),
      });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const directorySuffix = directoryPath
        ? `/${directoryPath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/')}`
        : '';
      const apiUrl = `${this.getHuggingFaceBaseEndpoint()}/api/models/${repoId}/tree/${encodeURIComponent(revision)}${directorySuffix}?${params.toString()}`;
      const response = await axios.get(apiUrl, {
        headers: this.buildHuggingFaceHeaders(),
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status === 404) {
        return [];
      }

      if (response.status !== 200) {
        throw new BadRequestException(
          `Upload blocked: Hugging Face validation failed with status ${response.status} while checking ${repoId}@${revision}.`,
        );
      }

      if (!Array.isArray(response.data)) {
        throw new BadRequestException(
          `Upload blocked: Hugging Face returned an unexpected response while checking ${repoId}@${revision}.`,
        );
      }

      entries.push(...(response.data as HuggingFaceTreeEntry[]));

      const nextCursor = this.extractHuggingFaceTreeNextCursor(
        this.readHeaderValue(response.headers?.link),
      );
      if (!nextCursor) {
        return entries;
      }

      if (seenCursors.has(nextCursor)) {
        return entries;
      }

      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    return entries;
  }

  private extractHuggingFaceTreeNextCursor(linkHeader: string | undefined): string | null {
    if (!linkHeader) {
      return null;
    }

    const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
    if (!nextLinkMatch) {
      return null;
    }

    try {
      const nextUrl = new URL(nextLinkMatch[1]);
      return nextUrl.searchParams.get('cursor');
    } catch {
      return null;
    }
  }

  private async fetchHuggingFaceHeadMetadata(
    target: HuggingFaceResolveTarget,
  ): Promise<HuggingFaceFileMetadata> {
    const filePath = target.filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const resolveUrl = `${this.getHuggingFaceBaseEndpoint()}/${target.repoId}/resolve/${encodeURIComponent(target.revision)}/${filePath}`;
    const response = await axios.head(resolveUrl, {
      headers: this.buildHuggingFaceHeaders(),
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    if (![200, 302, 307].includes(response.status)) {
      return { size: 0, timestamp: 0, sha256: null };
    }

    const linkedSize = this.readHeaderValue(response.headers['x-linked-size']);
    const contentLength = this.readHeaderValue(response.headers['content-length']);
    const parsedSize = Number.parseInt(linkedSize || contentLength || '0', 10);

    const lastModified = this.readHeaderValue(response.headers['last-modified']);
    const parsedTimestamp = this.parseDateToUnixTimestamp(lastModified);

    return {
      size: Number.isFinite(parsedSize) ? parsedSize : 0,
      timestamp: parsedTimestamp,
      sha256: this.normalizeSha256(this.readHeaderValue(response.headers['x-linked-etag'])),
    };
  }

  private parseHuggingFaceResolveUrl(rawUrl: string): HuggingFaceResolveTarget | null {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) {
      return null;
    }

    let normalizedPath = trimmedUrl;
    if (/^https?:\/\//i.test(trimmedUrl)) {
      try {
        const parsedUrl = new URL(trimmedUrl);
        if (!HUGGING_FACE_HOSTS.has(parsedUrl.hostname)) {
          return null;
        }
        normalizedPath = parsedUrl.pathname
          .replace(/^\/+/, '')
          .split('/')
          .map((segment) => decodeURIComponent(segment))
          .join('/');
      } catch {
        return null;
      }
    }

    const resolveMarker = '/resolve/';
    const markerIndex = normalizedPath.indexOf(resolveMarker);
    if (markerIndex === -1) {
      return null;
    }

    const repoId = normalizedPath.slice(0, markerIndex);
    const remainder = normalizedPath.slice(markerIndex + resolveMarker.length);
    const firstSlashIndex = remainder.indexOf('/');
    if (!repoId.match(/^[^/]+\/[^/]+$/) || firstSlashIndex === -1) {
      return null;
    }

    const revision = remainder.slice(0, firstSlashIndex);
    const filePath = remainder.slice(firstSlashIndex + 1);
    if (!revision || !filePath) {
      return null;
    }

    return {
      repoId,
      revision,
      filePath,
    };
  }

  private buildHuggingFaceHeaders() {
    return {
      'User-Agent': HUGGING_FACE_USER_AGENT,
      ...(Config.huggingface.token
        ? {
            Authorization: `Bearer ${Config.huggingface.token}`,
          }
        : {}),
    };
  }

  private getHuggingFaceBaseEndpoint(): string {
    return (Config.huggingface.endpoint || 'https://huggingface.co').replace(/\/$/, '');
  }

  private getModelScopeBaseEndpoint(): string {
    return (Config.modelscope.endpoint || 'https://modelscope.cn').replace(/\/$/, '');
  }

  private parseDateToUnixTimestamp(rawDate: string | undefined): number {
    if (!rawDate) {
      return 0;
    }

    const timestampMs = Date.parse(rawDate);
    if (!Number.isFinite(timestampMs)) {
      return 0;
    }

    return Math.floor(timestampMs / 1000);
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
