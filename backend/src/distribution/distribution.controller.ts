import { Controller, Get } from '@nestjs/common';
import { DistributionService } from './distribution.service';

@Controller('distributions')
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  @Get('latest')
  async getLatestDistributions() {
    return await this.distributionService.getLatestDistributions();
  }
}

