import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('location')
  async getLocation(@Req() req: Request) {
    // Extract IP from request
    // Check various headers for the real IP (in case of proxy/load balancer)
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined;

    const location = await this.appService.detectLocation({ ip });
    return location;
  }
}
