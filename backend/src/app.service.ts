import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { IncomingHttpHeaders } from 'http';

export interface LocationResult {
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  isMainlandChina: boolean;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly geoRequestTimeoutMs = 3000;

  private normalizeIp(ip?: string): string | undefined {
    if (!ip) {
      return undefined;
    }

    let normalized = ip.trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.slice(7);
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(normalized)) {
      normalized = normalized.replace(/:\d+$/, '');
    }

    return normalized;
  }

  /**
   * Check if IP is a local/reserved IP address
   */
  private isLocalOrReservedIP(ip?: string): boolean {
    const normalizedIp = this.normalizeIp(ip);
    if (!normalizedIp) return false;

    // Check for localhost
    if (normalizedIp === '127.0.0.1' || normalizedIp === '::1' || normalizedIp === 'localhost') {
      return true;
    }

    // Check for private IP ranges
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];

    return privateRanges.some((range) => range.test(normalizedIp));
  }

  private getUnknownLocation(country = 'Unknown'): LocationResult {
    return {
      country,
      countryCode: '',
      region: '',
      regionCode: '',
      isMainlandChina: false,
    };
  }

  private buildLocation(payload: {
    country?: string;
    countryCode?: string;
    region?: string;
    regionCode?: string;
  }): LocationResult {
    const countryCode = (payload.countryCode || '').toUpperCase();

    return {
      country: payload.country || countryCode || 'Unknown',
      countryCode,
      region: payload.region || '',
      regionCode: (payload.regionCode || '').toUpperCase(),
      isMainlandChina: countryCode === 'CN',
    };
  }

  private getHeaderValue(headers: IncomingHttpHeaders | undefined, name: string): string {
    const value = headers?.[name];
    if (Array.isArray(value)) {
      return value[0]?.trim() || '';
    }
    return typeof value === 'string' ? value.trim() : '';
  }

  private getLocationFromHeaders(headers?: IncomingHttpHeaders): LocationResult | null {
    const countryCode = (
      this.getHeaderValue(headers, 'cf-ipcountry') ||
      this.getHeaderValue(headers, 'cloudfront-viewer-country') ||
      this.getHeaderValue(headers, 'x-vercel-ip-country') ||
      this.getHeaderValue(headers, 'x-country-code')
    ).toUpperCase();

    if (!countryCode || countryCode === 'XX' || countryCode === 'T1') {
      return null;
    }

    const regionCode =
      this.getHeaderValue(headers, 'cloudfront-viewer-country-region') ||
      this.getHeaderValue(headers, 'x-vercel-ip-country-region') ||
      this.getHeaderValue(headers, 'x-region-code');

    return this.buildLocation({
      country: countryCode,
      countryCode,
      region: regionCode,
      regionCode,
    });
  }

  private async fetchLocationFromIpWhoIs(ip?: string): Promise<LocationResult | null> {
    const normalizedIp = this.normalizeIp(ip);
    const target = normalizedIp ? `/${normalizedIp}` : '';
    const url = `https://ipwho.is${target}`;

    const response = await axios.get<{
      success?: boolean;
      message?: string;
      country?: string;
      country_code?: string;
      region?: string;
      region_code?: string;
    }>(url, {
      timeout: this.geoRequestTimeoutMs,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'ipwho.is lookup failed');
    }

    return this.buildLocation({
      country: response.data.country,
      countryCode: response.data.country_code,
      region: response.data.region,
      regionCode: response.data.region_code,
    });
  }

  private async fetchLocationFromIpApiCo(ip?: string): Promise<LocationResult | null> {
    const normalizedIp = this.normalizeIp(ip);
    const target = normalizedIp ? `/${normalizedIp}` : '';
    const url = `https://ipapi.co${target}/json/`;

    const response = await axios.get<{
      error?: boolean;
      reason?: string;
      country_name?: string;
      country_code?: string;
      region?: string;
      region_code?: string;
    }>(url, {
      timeout: this.geoRequestTimeoutMs,
    });

    if (response.data.error) {
      throw new Error(response.data.reason || 'ipapi.co lookup failed');
    }

    return this.buildLocation({
      country: response.data.country_name,
      countryCode: response.data.country_code,
      region: response.data.region,
      regionCode: response.data.region_code,
    });
  }

  async detectLocation(options: {
    ip?: string;
    headers?: IncomingHttpHeaders;
  }): Promise<LocationResult> {
    const ip = this.normalizeIp(options.ip);
    const headerLocation = this.getLocationFromHeaders(options.headers);

    if (headerLocation) {
      return headerLocation;
    }

    // Check if it's a local/reserved IP
    if (this.isLocalOrReservedIP(ip)) {
      this.logger.debug(`Skipping geolocation for local/reserved IP: ${ip}`);
      return this.getUnknownLocation('Local');
    }

    const providers: Array<{
      name: string;
      lookup: () => Promise<LocationResult | null>;
    }> = [
      {
        name: 'ipwho.is',
        lookup: () => this.fetchLocationFromIpWhoIs(ip),
      },
      {
        name: 'ipapi.co',
        lookup: () => this.fetchLocationFromIpApiCo(ip),
      },
    ];

    for (const provider of providers) {
      try {
        const result = await provider.lookup();
        if (result) {
          return result;
        }
      } catch (error: any) {
        this.logger.debug(
          `Location lookup failed via ${provider.name} for IP ${ip}: ${error.message}`,
        );
      }
    }

    return this.getUnknownLocation();
  }
}
