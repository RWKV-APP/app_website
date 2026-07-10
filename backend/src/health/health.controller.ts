import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  async getReadiness() {
    try {
      await this.prisma.checkReadiness();
      return {
        status: 'ok',
        checks: {
          database: 'ok',
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: {
          database: 'unavailable',
        },
      });
    }
  }
}
