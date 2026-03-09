import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminRequest } from '../types/remote-config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const authorization = request.headers.authorization;
    const token = this.adminAuthService.extractToken(authorization);
    const session = this.adminAuthService.getSession(token);
    request.adminUser = session.username;
    return true;
  }
}
