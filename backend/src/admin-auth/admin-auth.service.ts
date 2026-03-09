import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

interface SessionPayload {
  sub: string;
  exp: number;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly username = process.env.ADMIN_USERNAME || 'admin';
  private readonly password = process.env.ADMIN_PASSWORD || 'rwkv-local-dev';
  private readonly secret = process.env.ADMIN_TOKEN_SECRET || 'rwkv-local-secret';
  private readonly ttlMs = this.parseTtlMs(process.env.ADMIN_TOKEN_TTL_HOURS);

  constructor() {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      this.logger.warn(
        'ADMIN_USERNAME or ADMIN_PASSWORD is not set. Falling back to development defaults.',
      );
    }
    if (!process.env.ADMIN_TOKEN_SECRET) {
      this.logger.warn(
        'ADMIN_TOKEN_SECRET is not set. Falling back to development default secret.',
      );
    }
  }

  login(input: { username?: string; password?: string }) {
    const username = (input.username || '').trim();
    const password = input.password || '';

    if (!this.safeEqual(username, this.username) || !this.safeEqual(password, this.password)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const expiresAt = Date.now() + this.ttlMs;
    const token = this.signToken({
      sub: this.username,
      exp: expiresAt,
    });

    return {
      token,
      username: this.username,
      expiresAt,
    };
  }

  getSession(token: string) {
    const payload = this.verifyToken(token);
    return {
      username: payload.sub,
      expiresAt: payload.exp,
    };
  }

  extractToken(rawAuthorizationHeader?: string): string {
    const value = (rawAuthorizationHeader || '').trim();
    if (!value.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = value.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }

  private signToken(payload: SessionPayload): string {
    const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(payloadPart);
    return `${payloadPart}.${signature}`;
  }

  private verifyToken(token: string): SessionPayload {
    const [payloadPart, signature] = token.split('.');
    if (!payloadPart || !signature) {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.sign(payloadPart);
    if (!this.safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid token');
    }

    let payload: SessionPayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf8'),
      ) as SessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub || !payload.exp) {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.exp <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }

    return payload;
  }

  private sign(payloadPart: string): string {
    return createHmac('sha256', this.secret).update(payloadPart).digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private parseTtlMs(rawHours: string | undefined): number {
    const parsedHours = Number.parseInt(rawHours || '12', 10);
    const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 12;
    return hours * 3600 * 1000;
  }
}
