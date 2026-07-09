import { Controller, Get, Post, Logger, Req } from '@nestjs/common';
import { Request } from 'express';
import { DistributionService } from './distribution.service';

type DistributionMap = Record<string, DistributionRecord | null>;
const APP_DOWNLOAD_LANDING_URL = 'https://rwkv.halowang.cloud/';
const APP_LATEST_VERSION_FALLBACK = '4.6.2';
const APP_LATEST_BUILD_FALLBACK = 745;
const IOS_LATEST_VERSION_FALLBACK = '4.5.11';
const IOS_LATEST_BUILD_FALLBACK = 742;
const IOS_DISTRIBUTION_KEYS = new Set(['iOSTF', 'iOSAS']);

interface DistributionRecord {
  id: number;
  type: string;
  url: string;
  version: string;
  build: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AppOverrideMetadata {
  version: string;
  build: number | null;
}

@Controller('distributions')
export class DistributionController {
  private readonly logger = new Logger(DistributionController.name);

  constructor(private readonly distributionService: DistributionService) {}

  private normalizeKeys(keys: string[]): string[] {
    const normalizedKeys: string[] = [];
    const seen = new Set<string>();

    for (const rawKey of keys) {
      const key = rawKey.trim();
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalizedKeys.push(key);
    }

    return normalizedKeys;
  }

  private extractKeysFromRawQuery(queryString: string): string[] {
    const candidates = [queryString];

    try {
      const decodedQueryString = decodeURIComponent(queryString);
      if (decodedQueryString !== queryString) {
        candidates.unshift(decodedQueryString);
      }
    } catch {
      // Keep the raw query string when decoding fails.
    }

    let bestMatch: string[] = [];

    for (const candidate of candidates) {
      const params = new URLSearchParams(candidate);
      const keys = this.normalizeKeys(params.getAll('key'));
      if (keys.length > bestMatch.length) {
        bestMatch = keys;
      }
    }

    return bestMatch;
  }

  private extractRequestedKeys(request: Request): string[] {
    const parsedKeys: string[] = [];

    if (request.query.key) {
      if (Array.isArray(request.query.key)) {
        parsedKeys.push(...(request.query.key as string[]));
      } else {
        parsedKeys.push(request.query.key as string);
      }
    }

    const normalizedParsedKeys = this.normalizeKeys(parsedKeys);
    const queryString = request.url?.split('?')[1];

    if (!queryString) {
      return normalizedParsedKeys;
    }

    const rawQueryKeys = this.extractKeysFromRawQuery(queryString);
    return rawQueryKeys.length > normalizedParsedKeys.length ? rawQueryKeys : normalizedParsedKeys;
  }

  private getFirstString(value: unknown): string | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
          return item.trim();
        }
      }
      return null;
    }

    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private getHeaderValue(request: Request, name: string): string | null {
    return this.getFirstString(request.headers[name.toLowerCase()]);
  }

  private hasAppRequestContext(request: Request): boolean {
    return Boolean(
      this.getHeaderValue(request, 'application-build-number') ||
      this.getHeaderValue(request, 'application-version') ||
      this.getHeaderValue(request, 'application-language') ||
      this.getHeaderValue(request, 'operating-system') ||
      this.getHeaderValue(request, 'operating-system-version'),
    );
  }

  private isSemanticVersion(version: string | null | undefined): version is string {
    return Boolean(version && /^\d+\.\d+\.\d+$/.test(version));
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
    const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index++) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;

      if (leftPart !== rightPart) {
        return leftPart - rightPart;
      }
    }

    return 0;
  }

  private pickNewerMetadata(
    current: AppOverrideMetadata,
    candidate: DistributionRecord | null,
  ): AppOverrideMetadata {
    if (!candidate || !this.isSemanticVersion(candidate.version)) {
      return current;
    }

    const versionCompare = this.compareVersions(candidate.version, current.version);
    if (versionCompare > 0) {
      return {
        version: candidate.version,
        build: candidate.build,
      };
    }

    if (versionCompare === 0) {
      const currentBuild = current.build ?? -1;
      const candidateBuild = candidate.build ?? -1;
      if (candidateBuild > currentBuild) {
        return {
          version: candidate.version,
          build: candidate.build,
        };
      }
    }

    return current;
  }

  private getAppOverrideMetadata(
    result: DistributionMap,
    iosOnly: boolean,
  ): AppOverrideMetadata {
    let metadata: AppOverrideMetadata = iosOnly
      ? { version: IOS_LATEST_VERSION_FALLBACK, build: IOS_LATEST_BUILD_FALLBACK }
      : { version: APP_LATEST_VERSION_FALLBACK, build: APP_LATEST_BUILD_FALLBACK };

    for (const [key, value] of Object.entries(result)) {
      const isIosKey = IOS_DISTRIBUTION_KEYS.has(key);
      if (iosOnly !== isIosKey) {
        continue;
      }

      metadata = this.pickNewerMetadata(metadata, value);
    }

    return metadata;
  }

  private applyAppRequestOverrides(
    result: DistributionMap,
    shouldRewrite: boolean,
  ): DistributionMap {
    if (!shouldRewrite) {
      return result;
    }

    const adaptedResult: DistributionMap = {};
    const appMetadata = this.getAppOverrideMetadata(result, false);
    const iosMetadata = this.getAppOverrideMetadata(result, true);

    for (const [key, value] of Object.entries(result)) {
      if (!value) {
        adaptedResult[key] = null;
        continue;
      }

      const metadata = IOS_DISTRIBUTION_KEYS.has(key) ? iosMetadata : appMetadata;
      adaptedResult[key] = {
        ...value,
        url: APP_DOWNLOAD_LANDING_URL,
        version: metadata.version,
        build: metadata.build,
      };
    }

    return adaptedResult;
  }

  @Get('latest')
  async getLatestDistributions(@Req() request: Request) {
    // Older clients accidentally percent-encode the whole repeated key query string,
    // so we need to support both the standard format and the malformed encoded one.
    const keyArray = this.extractRequestedKeys(request);
    const isAppRequest = this.hasAppRequestContext(request);

    // getLatestDistributions handles all errors internally and never throws
    // It always returns an object (may be empty if database is unavailable)
    const latestDistributions = await this.distributionService.getLatestDistributions();
    const result = this.applyAppRequestOverrides(
      latestDistributions as DistributionMap,
      isAppRequest,
    );

    if (isAppRequest) {
      this.logger.debug(
        'Rewrote /distributions/latest response for app clients with landing URL and pinned platform version metadata',
      );
    }

    // Filter result if keys are provided
    let filteredResult = result;
    if (keyArray && keyArray.length > 0) {
      filteredResult = {};
      for (const key of keyArray) {
        if (key in result) {
          filteredResult[key] = result[key];
        }
      }
    }

    // Remove id field from each value
    const resultWithoutId: Record<string, Omit<DistributionRecord, 'id'> | null> = {};
    for (const [key, value] of Object.entries(filteredResult)) {
      if (value === null) {
        resultWithoutId[key] = null;
      } else {
        const { id, ...valueWithoutId } = value as DistributionRecord;
        resultWithoutId[key] = valueWithoutId;
      }
    }

    return resultWithoutId;
  }

  @Post('refresh')
  async refreshDistributions() {
    try {
      // allInOne handles all errors internally and never throws
      await this.distributionService.allInOne();

      // Return the latest distributions that were successfully fetched
      const distributions = await this.distributionService.getLatestDistributions();

      return {
        success: true,
        message: 'Distribution check completed',
        distributions,
      };
    } catch (error: unknown) {
      // Even if getLatestDistributions fails, try to return what we have
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in refreshDistributions: ${errorMessage}`, errorStack);
      try {
        const distributions = await this.distributionService.getLatestDistributions();
        return {
          success: true,
          message: 'Distribution check completed with some errors',
          distributions,
          warning: errorMessage,
        };
      } catch (fallbackError: unknown) {
        // Last resort: return empty but don't fail
        const fallbackErrorMessage =
          fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
        this.logger.error(`Failed to get distributions even in fallback: ${fallbackErrorMessage}`);
        return {
          success: true,
          message: 'Distribution check completed, but failed to retrieve results',
          distributions: {},
          warning: 'Failed to retrieve distributions',
        };
      }
    }
  }
}
