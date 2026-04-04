import { Controller, Get, Post, Logger, Req } from '@nestjs/common';
import { Request } from 'express';
import { DistributionService } from './distribution.service';

interface DistributionRecord {
  id: number;
  type: string;
  url: string;
  version: string;
  build: number | null;
  createdAt: Date;
  updatedAt: Date;
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

  @Get('latest')
  async getLatestDistributions(@Req() request: Request) {
    // Older clients accidentally percent-encode the whole repeated key query string,
    // so we need to support both the standard format and the malformed encoded one.
    const keyArray = this.extractRequestedKeys(request);

    // getLatestDistributions handles all errors internally and never throws
    // It always returns an object (may be empty if database is unavailable)
    const result = await this.distributionService.getLatestDistributions();

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
