import { Controller, Get, Post, Logger, Query, Req } from '@nestjs/common';
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

  @Get('latest')
  async getLatestDistributions(@Req() request: Request) {
    // Manually extract 'key' parameter from query string
    // NestJS may not properly handle multiple query params with same name
    const keyArray: string[] = [];

    // Method 1: Try to get from request.query (NestJS parsed)
    if (request.query.key) {
      if (Array.isArray(request.query.key)) {
        keyArray.push(...(request.query.key as string[]));
      } else {
        keyArray.push(request.query.key as string);
      }
    }

    // Method 2: Parse from raw query string if method 1 didn't work or only got one value
    if (keyArray.length <= 1 && request.url) {
      // Extract query string from URL
      const queryString = request.url.split('?')[1];
      if (queryString) {
        // Parse query string manually using regex
        const keyMatches = queryString.match(/key=([^&]+)/g);
        if (keyMatches && keyMatches.length > keyArray.length) {
          keyArray.length = 0;
          for (const match of keyMatches) {
            const value = decodeURIComponent(match.split('=')[1]);
            keyArray.push(value);
          }
        }
      }
    }

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
