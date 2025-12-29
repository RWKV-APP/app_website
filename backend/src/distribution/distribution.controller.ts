import { Controller, Get, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DistributionService } from './distribution.service';

@Controller('distributions')
export class DistributionController {
  private readonly logger = new Logger(DistributionController.name);

  constructor(private readonly distributionService: DistributionService) {}

  @Get('latest')
  async getLatestDistributions() {
    // getLatestDistributions handles all errors internally and never throws
    // It always returns an object (may be empty if database is unavailable)
    const result = await this.distributionService.getLatestDistributions();
    return result;
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
    } catch (error: any) {
      // Even if getLatestDistributions fails, try to return what we have
      this.logger.error(`Error in refreshDistributions: ${error.message}`, error.stack);
      try {
        const distributions = await this.distributionService.getLatestDistributions();
        return {
          success: true,
          message: 'Distribution check completed with some errors',
          distributions,
          warning: error.message,
        };
      } catch (fallbackError: any) {
        // Last resort: return empty but don't fail
        this.logger.error(`Failed to get distributions even in fallback: ${fallbackError.message}`);
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

