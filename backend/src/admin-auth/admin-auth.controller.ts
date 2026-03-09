import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminRequest, REMOTE_CONFIG_ACTIONS } from '../types/remote-config';
import { RemoteConfigService } from '../remote-config/remote-config.service';

interface LoginBody {
  username?: string;
  password?: string;
}

@Controller('admin-api/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginBody) {
    const session = this.adminAuthService.login(body);
    await this.remoteConfigService.logActivity({
      action: REMOTE_CONFIG_ACTIONS.login,
      username: session.username,
      detail: {
        expiresAt: session.expiresAt,
      },
    });

    return session;
  }

  @Get('session')
  @UseGuards(AdminAuthGuard)
  getSession(@Req() request: AdminRequest) {
    const token = this.adminAuthService.extractToken(request.headers.authorization);
    const session = this.adminAuthService.getSession(token);
    return {
      username: session.username,
      expiresAt: session.expiresAt,
    };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  async logout(@Req() request: AdminRequest) {
    await this.remoteConfigService.logActivity({
      action: REMOTE_CONFIG_ACTIONS.logout,
      username: request.adminUser || 'unknown',
    });

    return {
      success: true,
    };
  }
}
