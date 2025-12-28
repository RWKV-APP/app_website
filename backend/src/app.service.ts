import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    this.logger.debug('getHello called');
    return 'Hello World!';
  }

  /**
   * Check if IP is a local/reserved IP address
   */
  private isLocalOrReservedIP(ip?: string): boolean {
    if (!ip) return false;

    // Check for localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true;
    }

    // Check for private IP ranges
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];

    return privateRanges.some((range) => range.test(ip));
  }

  async detectLocation(options: { ip?: string }): Promise<{
    country: string;
    countryCode: string;
    region: string;
    regionCode: string;
    isMainlandChina: boolean;
  }> {
    const { ip } = options;

    // Check if it's a local/reserved IP
    if (this.isLocalOrReservedIP(ip)) {
      this.logger.debug(`Skipping geolocation for local/reserved IP: ${ip}`);
      return {
        country: 'Local',
        countryCode: '',
        region: '',
        regionCode: '',
        isMainlandChina: false,
      };
    }

    try {
      // Use ip-api.com free API (no API key required)
      // Format: http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName
      const apiUrl = ip
        ? `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName`
        : 'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName';

      const response = await axios.get(apiUrl, {
        timeout: 5000,
      });

      if (response.data.status === 'success') {
        const countryCode = response.data.countryCode || '';
        const country = response.data.country || '';
        const region = response.data.regionName || '';
        const regionCode = response.data.region || '';
        // Check if it's mainland China (CN)
        // Note: HK, MO, TW are separate country codes, not CN
        const isMainlandChina = countryCode === 'CN';

        return {
          country,
          countryCode,
          region,
          regionCode,
          isMainlandChina,
        };
      } else {
        // For reserved range or other errors, use debug level instead of warn
        const errorMessage = response.data.message || 'Unknown error';
        if (errorMessage === 'reserved range' || errorMessage === 'private range') {
          this.logger.debug(`IP geolocation skipped for reserved/private IP: ${ip}`);
        } else {
          this.logger.warn(`IP geolocation API returned error: ${errorMessage}`);
        }
        // Return default (not mainland China) on error
        return {
          country: 'Unknown',
          countryCode: '',
          region: '',
          regionCode: '',
          isMainlandChina: false,
        };
      }
    } catch (error: any) {
      this.logger.debug(`Failed to detect location for IP ${ip}: ${error.message}`);
      // Return default (not mainland China) on error
      return {
        country: 'Unknown',
        countryCode: '',
        region: '',
        regionCode: '',
        isMainlandChina: false,
      };
    }
  }
}
