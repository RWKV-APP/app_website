import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { DistributionType } from '../types/distribution';
import { Config } from '../config';

@Injectable()
export class DistributionService implements OnModuleInit {
  private readonly logger = new Logger(DistributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('DistributionService initialized, scheduling allInOne...');
    // Don't await - run in background so it doesn't block service startup
    // If allInOne fails, it won't prevent the service from starting
    this.allInOne().catch((error: any) => {
      this.logger.error(`Error in onModuleInit allInOne: ${error.message}`, error.stack);
    });
  }

  @Cron('0 */30 * * * *') // Every 30 minutes
  async handleCron() {
    this.logger.log('Running scheduled allInOne check...');
    try {
      await this.allInOne();
    } catch (error: any) {
      this.logger.error(`Error in scheduled allInOne: ${error.message}`, error.stack);
      // Don't throw - allow cron to continue
    }
  }

  async allInOne() {
    try {
      this.logger.log('Starting allInOne distribution check...');

      const distributionTypes = Object.values(DistributionType);

      for (const type of distributionTypes) {
        try {
          await this.checkDistribution(type);
        } catch (error: any) {
          this.logger.error(
            `Error checking distribution type ${type}: ${error.message}`,
            error.stack,
          );
          // Continue with next type even if one fails
        }
      }

      this.logger.log('Completed allInOne distribution check');
    } catch (error: any) {
      // Catch any unexpected errors (e.g., DistributionType.values() fails)
      this.logger.error(`Fatal error in allInOne: ${error.message}`, error.stack);
      // Don't throw - allow the process to continue
      // Individual type errors are already handled above
    }
  }

  private async checkDistribution(type: DistributionType) {
    switch (type) {
      case DistributionType.macosHF:
        await this.checkMacosHF();
        break;
      case DistributionType.macosAF:
        await this.checkMacosAF();
        break;
      case DistributionType.macosGR:
        await this.checkMacosGR();
        break;
      case DistributionType.macosHFM:
        await this.checkMacosHFM();
        break;
      case DistributionType.linuxHF:
        await this.checkLinuxHF();
        break;
      case DistributionType.linuxAF:
        await this.checkLinuxAF();
        break;
      case DistributionType.linuxGR:
        await this.checkLinuxGR();
        break;
      case DistributionType.linuxHFM:
        await this.checkLinuxHFM();
        break;
      case DistributionType.winHF:
        await this.checkWinHF();
        break;
      case DistributionType.winAF:
        await this.checkWinAF();
        break;
      case DistributionType.winGR:
        await this.checkWinGR();
        break;
      case DistributionType.winHFM:
        await this.checkWinHFM();
        break;
      case DistributionType.winZipHF:
        await this.checkWinZipHF();
        break;
      case DistributionType.winZipAF:
        await this.checkWinZipAF();
        break;
      case DistributionType.winZipGR:
        await this.checkWinZipGR();
        break;
      case DistributionType.winZipHFM:
        await this.checkWinZipHFM();
        break;
      case DistributionType.iOSTF:
        await this.checkIOSTF();
        break;
      case DistributionType.iOSAS:
        await this.checkIOSAS();
        break;
      case DistributionType.androidHF:
        await this.checkAndroidHF();
        break;
      case DistributionType.androidAF:
        await this.checkAndroidAF();
        break;
      case DistributionType.androidGR:
        await this.checkAndroidGR();
        break;
      case DistributionType.androidHFM:
        await this.checkAndroidHFM();
        break;
      case DistributionType.androidPgyerAPK:
        await this.checkAndroidPgyerAPK();
        break;
      case DistributionType.androidPgyer:
        await this.checkAndroidPgyer();
        break;
      case DistributionType.androidGooglePlay:
        await this.checkAndroidGooglePlay();
        break;
      default:
        this.logger.warn(`Unknown distribution type: ${type}`);
    }
  }

  // Helper method to check HuggingFace distribution
  private async checkHuggingFaceDistribution(options: {
    type: DistributionType;
    folderPath: string;
    fileExtension: string;
    endpoint?: string;
  }) {
    const { type, folderPath, fileExtension, endpoint } = options;
    const repoId = Config.huggingface.repoId;
    const baseEndpoint = endpoint || Config.huggingface.endpoint;

    if (!repoId) {
      this.logger.warn(`HF_DATASETS_ID not configured, skipping ${type}`);
      return;
    }

    try {
      // Use HuggingFace API to list files in the folder
      const apiUrl = `${baseEndpoint}/api/datasets/${repoId}/tree/main/${folderPath}`;
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: Config.huggingface.token
            ? `Bearer ${Config.huggingface.token}`
            : undefined,
        },
        timeout: 30000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(`No files found in ${folderPath} for ${type}`);
        return;
      }

      // Filter files by extension and find the latest one
      const files = response.data.filter(
        (file: any) => file.path && file.path.endsWith(fileExtension),
      );

      if (files.length === 0) {
        this.logger.warn(`No ${fileExtension} files found in ${folderPath} for ${type}`);
        return;
      }

      // Sort by lastModified (most recent first) or by filename
      const sortedFiles = files.sort((a: any, b: any) => {
        if (a.lastModified && b.lastModified) {
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        }
        // Fallback to filename comparison
        return b.path.localeCompare(a.path);
      });

      // Process all files, not just the latest one
      let savedCount = 0;
      for (const file of sortedFiles) {
        const fileName = file.path.split('/').pop() || '';
        const filePath = `${folderPath}/${fileName}`;

        // Parse version and build from filename
        // Supported formats:
        // 1. rwkv_chat_3.4.0_609.apk (Android APK: rwkv_chat_{version}_{build}.apk)
        // 2. rwkv_chat_3.4.0_609_linux-x64.tar.gz (Linux: rwkv_chat_{version}_{build}_{platform}.{ext})
        // 3. rwkv_chat_3.4.0_609_windows-x64.zip (Windows zip)
        // 4. rwkv_chat_3.4.0_609_windows-x64-setup.exe (Windows installer)
        // 5. rwkv_chat_3.4.0_609_macos-universal.dmg (macOS DMG)
        // 6. 3.4.0+609 (format: {version}+{build})
        // 7. app-3.4.0+609.dmg (format: {prefix}-{version}+{build}.{ext})

        let version = '';
        let build: number | null = null;

        // Try format: rwkv_chat_{version}_{build} (with optional platform suffix)
        // This matches:
        // - rwkv_chat_3.4.0_609.apk
        // - rwkv_chat_3.4.0_609_linux-x64.tar.gz
        // - rwkv_chat_3.4.0_609_windows-x64.zip
        // - rwkv_chat_3.4.0_609_windows-x64-setup.exe
        // - rwkv_chat_3.4.0_609_macos-universal.dmg
        const rwkvChatMatch = fileName.match(/rwkv_chat_(\d+\.\d+\.\d+)_(\d+)(?:_|\.)/);
        if (rwkvChatMatch) {
          version = rwkvChatMatch[1];
          build = parseInt(rwkvChatMatch[2], 10);
        } else {
          // Try format: {version}+{build} or {prefix}-{version}+{build}.{ext}
          const versionMatch = fileName.match(/(\d+\.\d+\.\d+)(?:\+(\d+)|_(\d+))?/);
          if (versionMatch) {
            version = versionMatch[1];
            build = versionMatch[2]
              ? parseInt(versionMatch[2], 10)
              : versionMatch[3]
                ? parseInt(versionMatch[3], 10)
                : null;
          }
        }

        // Skip if we couldn't parse version and build
        if (!version) {
          this.logger.warn(`Could not parse version from filename: ${fileName}`);
          continue;
        }

        // version should only contain semantic version (e.g., "3.4.0"), not "3.4.0+609"
        // build number is stored separately in the build field

        // Build download URL
        const downloadUrl = `${baseEndpoint}/datasets/${repoId}/resolve/main/${filePath}`;

        // Save or update in database
        await this.saveDistribution({
          type,
          url: downloadUrl,
          version, // Only semantic version, e.g., "3.4.0"
          build, // Build number separately, e.g., 609
        });

        savedCount++;
        const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
        this.logger.log(`✅ Saved ${type}: ${fileName} (${displayVersion})`);
      }

      this.logger.log(`✅ Processed ${savedCount} file(s) for ${type}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Folder ${folderPath} not found for ${type}`);
      } else {
        this.logger.error(`Error checking ${type}: ${error.message}`);
      }
    }
  }

  // Helper method to check Aifasthub distribution (mirror of HuggingFace)
  private async checkAifasthubDistribution(options: {
    type: DistributionType;
    folderPath: string;
    fileExtension: string;
  }) {
    const { type, folderPath, fileExtension } = options;
    const repoId = Config.huggingface.repoId;
    const baseEndpoint = 'https://aifasthub.com';

    if (!repoId) {
      this.logger.warn(`HF_DATASETS_ID not configured, skipping ${type}`);
      return;
    }

    try {
      // Use Aifasthub API to list files in the folder (similar to HuggingFace)
      const apiUrl = `${baseEndpoint}/api/datasets/${repoId}/tree/main/${folderPath}`;
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: Config.huggingface.token
            ? `Bearer ${Config.huggingface.token}`
            : undefined,
        },
        timeout: 30000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(`No files found in ${folderPath} for ${type}`);
        return;
      }

      // Filter files by extension
      const files = response.data.filter(
        (file: any) => file.path && file.path.endsWith(fileExtension),
      );

      if (files.length === 0) {
        this.logger.warn(`No ${fileExtension} files found in ${folderPath} for ${type}`);
        return;
      }

      // Sort by lastModified (most recent first) or by filename
      const sortedFiles = files.sort((a: any, b: any) => {
        if (a.lastModified && b.lastModified) {
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        }
        return b.path.localeCompare(a.path);
      });

      // Process all files
      let savedCount = 0;
      for (const file of sortedFiles) {
        const fileName = file.path.split('/').pop() || '';
        const filePath = `${folderPath}/${fileName}`;

        // Parse version and build from filename (same logic as HuggingFace)
        let version = '';
        let build: number | null = null;

        const rwkvChatMatch = fileName.match(/rwkv_chat_(\d+\.\d+\.\d+)_(\d+)(?:_|\.)/);
        if (rwkvChatMatch) {
          version = rwkvChatMatch[1];
          build = parseInt(rwkvChatMatch[2], 10);
        } else {
          const versionMatch = fileName.match(/(\d+\.\d+\.\d+)(?:\+(\d+)|_(\d+))?/);
          if (versionMatch) {
            version = versionMatch[1];
            build = versionMatch[2]
              ? parseInt(versionMatch[2], 10)
              : versionMatch[3]
                ? parseInt(versionMatch[3], 10)
                : null;
          }
        }

        if (!version) {
          this.logger.warn(`Could not parse version from filename: ${fileName}`);
          continue;
        }

        // Build download URL with ?download=true suffix (as per aifasthub format)
        const downloadUrl = `${baseEndpoint}/datasets/${repoId}/resolve/main/${filePath}?download=true`;

        await this.saveDistribution({
          type,
          url: downloadUrl,
          version,
          build,
        });

        savedCount++;
        const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
        this.logger.log(`✅ Saved ${type}: ${fileName} (${displayVersion})`);
      }

      this.logger.log(`✅ Processed ${savedCount} file(s) for ${type}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Folder ${folderPath} not found for ${type}`);
      } else {
        this.logger.error(`Error checking ${type}: ${error.message}`);
      }
    }
  }

  // Helper method to check GitHub Release distribution
  private async checkGitHubReleaseDistribution(options: {
    type: DistributionType;
    fileExtension: string;
    fileNamePattern: RegExp;
  }) {
    const { type, fileExtension, fileNamePattern } = options;
    const { repo, token } = Config.github;

    if (!repo) {
      this.logger.warn(`GITHUB_REPO not configured, skipping ${type}`);
      return;
    }

    try {
      // Get latest release from GitHub API
      const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(apiUrl, {
        headers,
        timeout: 30000,
      });

      if (!response.data || !response.data.assets || !Array.isArray(response.data.assets)) {
        this.logger.warn(`No assets found in latest release for ${type}`);
        return;
      }

      // Filter assets by extension and filename pattern
      const matchingAssets = response.data.assets.filter((asset: any) => {
        const name = asset.name || '';
        return (
          name.endsWith(fileExtension) && fileNamePattern.test(name) && asset.browser_download_url
        );
      });

      if (matchingAssets.length === 0) {
        this.logger.warn(`No matching ${fileExtension} files found in latest release for ${type}`);
        return;
      }

      // Sort by upload time (most recent first)
      const sortedAssets = matchingAssets.sort((a: any, b: any) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      // Process all matching assets
      let savedCount = 0;
      for (const asset of sortedAssets) {
        const fileName = asset.name || '';
        const downloadUrl = asset.browser_download_url;

        // Parse version and build from filename
        let version = '';
        let build: number | null = null;

        // Try format: rwkv_chat_{version}_{build} (with optional platform suffix)
        const rwkvChatMatch = fileName.match(/rwkv_chat_(\d+\.\d+\.\d+)_(\d+)(?:_|\.)/);
        if (rwkvChatMatch) {
          version = rwkvChatMatch[1];
          build = parseInt(rwkvChatMatch[2], 10);
        } else {
          // Try format: {version}+{build} or {prefix}-{version}+{build}.{ext}
          const versionMatch = fileName.match(/(\d+\.\d+\.\d+)(?:\+(\d+)|_(\d+))?/);
          if (versionMatch) {
            version = versionMatch[1];
            build = versionMatch[2]
              ? parseInt(versionMatch[2], 10)
              : versionMatch[3]
                ? parseInt(versionMatch[3], 10)
                : null;
          }
        }

        // If we couldn't parse from filename, try to use release tag name
        if (!version && response.data.tag_name) {
          const tagMatch = response.data.tag_name.match(/v?(\d+\.\d+\.\d+)(?:\+(\d+)|-(\d+))?/);
          if (tagMatch) {
            version = tagMatch[1];
            build = tagMatch[2]
              ? parseInt(tagMatch[2], 10)
              : tagMatch[3]
                ? parseInt(tagMatch[3], 10)
                : null;
          }
        }

        if (!version) {
          this.logger.warn(`Could not parse version from filename or tag: ${fileName}`);
          continue;
        }

        await this.saveDistribution({
          type,
          url: downloadUrl,
          version,
          build,
        });

        savedCount++;
        const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
        this.logger.log(`✅ Saved ${type}: ${fileName} (${displayVersion})`);
      }

      this.logger.log(`✅ Processed ${savedCount} file(s) for ${type}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Latest release not found for ${type}`);
      } else {
        this.logger.error(`Error checking ${type}: ${error.message}`);
      }
    }
  }

  private async saveDistribution(options: {
    type: DistributionType;
    url: string;
    version: string;
    build: number | null;
  }) {
    const { type, url, version, build } = options;

    // For fixed URL types (App Store, Play Store), update existing record instead of creating new one
    const fixedUrlTypes = [DistributionType.iOSAS, DistributionType.androidGooglePlay];

    if (fixedUrlTypes.includes(type)) {
      // For fixed URL types, find existing record by type and url
      const existing = await this.prisma.distribution.findFirst({
        where: {
          type,
          url,
        },
      });

      if (existing) {
        // Check if version or build has changed
        if ((existing as any).version === version && (existing as any).build === build) {
          // No change, skip update
          this.logger.debug(
            `Record already exists with same version: ${type} - ${version} (${build}) - ${url}`,
          );
          return;
        }

        // Update existing record with new version/build
        await this.prisma.distribution.update({
          where: { id: existing.id },
          data: {
            version,
            build,
          } as any,
        });

        const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
        this.logger.debug(`Updated distribution record: ${type} - ${displayVersion} - ${url}`);
        return;
      }
    }

    // For other types or if no existing record found, check if identical record exists
    const existing = await this.prisma.distribution.findFirst({
      where: {
        type,
        url,
        version,
        build,
      },
    });

    if (existing) {
      // Record with identical type, url, version, and build already exists, skip
      this.logger.debug(`Record already exists: ${type} - ${version} (${build}) - ${url}`);
      return;
    }

    // No existing record found (existing is null), create new record
    // Note: We don't need deleteMany here since findFirst already confirmed no record exists
    await this.prisma.distribution.create({
      data: {
        type,
        url,
        version,
        build,
      } as any,
    });

    const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
    this.logger.debug(`Created new distribution record: ${type} - ${displayVersion} - ${url}`);
  }

  // macOS distribution checkers
  private async checkMacosHF() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.macosHF,
      folderPath: 'macos-universal',
      fileExtension: '.dmg',
    });
  }

  private async checkMacosAF() {
    await this.checkAifasthubDistribution({
      type: DistributionType.macosAF,
      folderPath: 'macos-universal',
      fileExtension: '.dmg',
    });
  }

  private async checkMacosGR() {
    await this.checkGitHubReleaseDistribution({
      type: DistributionType.macosGR,
      fileExtension: '.dmg',
      fileNamePattern: /macos|universal/i,
    });
  }

  private async checkMacosHFM() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.macosHFM,
      folderPath: 'macos-universal',
      fileExtension: '.dmg',
      endpoint: 'https://hf-mirror.com',
    });
  }

  // Linux distribution checkers
  private async checkLinuxHF() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.linuxHF,
      folderPath: 'linux-x64',
      fileExtension: '.tar.gz',
    });
  }

  private async checkLinuxAF() {
    await this.checkAifasthubDistribution({
      type: DistributionType.linuxAF,
      folderPath: 'linux-x64',
      fileExtension: '.tar.gz',
    });
  }

  private async checkLinuxGR() {
    await this.checkGitHubReleaseDistribution({
      type: DistributionType.linuxGR,
      fileExtension: '.tar.gz',
      fileNamePattern: /linux/i,
    });
  }

  private async checkLinuxHFM() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.linuxHFM,
      folderPath: 'linux-x64',
      fileExtension: '.tar.gz',
      endpoint: 'https://hf-mirror.com',
    });
  }

  // Windows distribution checkers
  private async checkWinHF() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.winHF,
      folderPath: 'windows-x64-installer',
      fileExtension: '.exe',
    });
  }

  private async checkWinAF() {
    await this.checkAifasthubDistribution({
      type: DistributionType.winAF,
      folderPath: 'windows-x64-installer',
      fileExtension: '.exe',
    });
  }

  private async checkWinGR() {
    await this.checkGitHubReleaseDistribution({
      type: DistributionType.winGR,
      fileExtension: '.exe',
      fileNamePattern: /windows.*installer|setup/i,
    });
  }

  private async checkWinHFM() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.winHFM,
      folderPath: 'windows-x64-installer',
      fileExtension: '.exe',
      endpoint: 'https://hf-mirror.com',
    });
  }

  // Windows Zip distribution checkers
  private async checkWinZipHF() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.winZipHF,
      folderPath: 'windows-x64',
      fileExtension: '.zip',
    });
  }

  private async checkWinZipAF() {
    await this.checkAifasthubDistribution({
      type: DistributionType.winZipAF,
      folderPath: 'windows-x64',
      fileExtension: '.zip',
    });
  }

  private async checkWinZipGR() {
    await this.checkGitHubReleaseDistribution({
      type: DistributionType.winZipGR,
      fileExtension: '.zip',
      fileNamePattern: /windows/i,
    });
  }

  private async checkWinZipHFM() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.winZipHFM,
      folderPath: 'windows-x64',
      fileExtension: '.zip',
      endpoint: 'https://hf-mirror.com',
    });
  }

  // iOS distribution checkers
  private async checkIOSTF() {
    // TODO: Implement iOS TestFlight link detection
  }

  private async checkIOSAS() {
    // iOS App Store link is fixed
    const appStoreUrl = 'https://apps.apple.com/us/app/rwkv-chat/id6740192639';
    const appId = '6740192639';

    let version = 'latest';
    const build: number | null = null;

    try {
      // Use iTunes Search API to get app version
      const response = await axios.get(`https://itunes.apple.com/lookup?id=${appId}`, {
        timeout: 10000,
      });

      if (response.data && response.data.results && response.data.results.length > 0) {
        const appInfo = response.data.results[0];
        if (appInfo.version) {
          version = appInfo.version;
          this.logger.log(`✅ Fetched App Store version: ${version}`);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to fetch App Store version: ${error.message}`);
      // Fallback to 'latest' if API call fails
    }

    await this.saveDistribution({
      type: DistributionType.iOSAS,
      url: appStoreUrl,
      version,
      build,
    });

    this.logger.log(`✅ Updated ${DistributionType.iOSAS}: App Store link (version: ${version})`);
  }

  // Android distribution checkers
  private async checkAndroidHF() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.androidHF,
      folderPath: 'android-arm64',
      fileExtension: '.apk',
    });
  }

  private async checkAndroidAF() {
    await this.checkAifasthubDistribution({
      type: DistributionType.androidAF,
      folderPath: 'android-arm64',
      fileExtension: '.apk',
    });
  }

  private async checkAndroidGR() {
    await this.checkGitHubReleaseDistribution({
      type: DistributionType.androidGR,
      fileExtension: '.apk',
      // Match APK files that don't contain other platform keywords
      // This matches files like rwkv_chat_3.4.1_626.apk
      // Negative lookahead to exclude macos, linux, windows, universal
      fileNamePattern: /^(?!.*(?:macos|linux|windows|universal))/i,
    });
  }

  private async checkAndroidHFM() {
    await this.checkHuggingFaceDistribution({
      type: DistributionType.androidHFM,
      folderPath: 'android-arm64',
      fileExtension: '.apk',
      endpoint: 'https://hf-mirror.com',
    });
  }

  private async checkAndroidPgyerAPK() {
    const { apiKey, appKey } = Config.pgyer;

    // Check if apiKey is empty or undefined
    if (!apiKey || apiKey.trim() === '') {
      this.logger.warn(
        `PGYER_API_KEY not configured, skipping ${DistributionType.androidPgyerAPK}`,
      );
      return;
    }

    if (!appKey || appKey.trim() === '') {
      this.logger.warn(
        `PGYER_APP_KEY not configured, skipping ${DistributionType.androidPgyerAPK}`,
      );
      return;
    }

    try {
      // Use Pgyer API v2 to get app information
      // Pgyer API supports both GET and POST
      const trimmedApiKey = apiKey.trim();
      const trimmedAppKey = appKey.trim();

      // Log the API key (masked for security)
      this.logger.debug(
        `Calling Pgyer API for ${DistributionType.androidPgyerAPK} with appKey: ${trimmedAppKey}, apiKey length: ${trimmedApiKey.length}`,
      );

      // Try GET request first (Pgyer API may prefer GET)
      const apiUrl = 'https://www.pgyer.com/apiv2/app/view';
      const response = await axios.get(apiUrl, {
        params: {
          _api_key: trimmedApiKey,
          appKey: trimmedAppKey,
        },
        timeout: 30000,
      });

      if (!response.data || response.data.code !== 0) {
        this.logger.warn(
          `Failed to get Pgyer app info for ${DistributionType.androidPgyerAPK}: ${response.data?.message || 'Unknown error'}`,
        );
        // Log full response for debugging
        this.logger.debug(`Pgyer API response: ${JSON.stringify(response.data)}`);
        return;
      }

      const appData = response.data.data;
      if (!appData || !appData.buildKey) {
        this.logger.warn(
          `No buildKey found in Pgyer response for ${DistributionType.androidPgyerAPK}`,
        );
        this.logger.debug(`Pgyer API response: ${JSON.stringify(response.data)}`);
        return;
      }

      // Parse version and build from appData
      let version = '';
      let build: number | null = null;

      // Use buildVersion field (e.g., "3.4.1")
      if (appData.buildVersion) {
        const versionMatch = appData.buildVersion.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          version = versionMatch[1];
        } else {
          version = appData.buildVersion;
        }
      }

      // Use buildVersionNo field for build number (e.g., "627")
      if (appData.buildVersionNo) {
        const buildMatch = appData.buildVersionNo.match(/(\d+)/);
        if (buildMatch) {
          build = parseInt(buildMatch[1], 10);
        }
      }

      if (!version) {
        this.logger.warn(
          `Could not parse version from Pgyer response for ${DistributionType.androidPgyerAPK}`,
        );
        return;
      }

      // Build direct APK download URL using buildKey
      // Pgyer direct download format: https://www.pgyer.com/app/install/{buildKey}
      const downloadUrl = `https://www.pgyer.com/app/install/${appData.buildKey}`;

      await this.saveDistribution({
        type: DistributionType.androidPgyerAPK,
        url: downloadUrl,
        version,
        build,
      });

      const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
      this.logger.log(
        `✅ Saved ${DistributionType.androidPgyerAPK}: ${downloadUrl} (${displayVersion})`,
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Pgyer app not found for ${DistributionType.androidPgyerAPK}`);
      } else {
        this.logger.error(`Error checking ${DistributionType.androidPgyerAPK}: ${error.message}`);
      }
    }
  }

  private async checkAndroidPgyer() {
    const { apiKey, appKey } = Config.pgyer;

    // Check if apiKey is empty or undefined
    if (!apiKey || apiKey.trim() === '') {
      this.logger.warn(`PGYER_API_KEY not configured, skipping ${DistributionType.androidPgyer}`);
      return;
    }

    if (!appKey || appKey.trim() === '') {
      this.logger.warn(`PGYER_APP_KEY not configured, skipping ${DistributionType.androidPgyer}`);
      return;
    }

    try {
      // Use Pgyer API v2 to get app information
      // Pgyer API supports both GET and POST
      const trimmedApiKey = apiKey.trim();
      const trimmedAppKey = appKey.trim();

      // Log the API key (masked for security)
      this.logger.debug(
        `Calling Pgyer API for ${DistributionType.androidPgyer} with appKey: ${trimmedAppKey}, apiKey length: ${trimmedApiKey.length}`,
      );

      // Try GET request first (Pgyer API may prefer GET)
      const apiUrl = 'https://www.pgyer.com/apiv2/app/view';
      const response = await axios.get(apiUrl, {
        params: {
          _api_key: trimmedApiKey,
          appKey: trimmedAppKey,
        },
        timeout: 30000,
      });

      if (!response.data || response.data.code !== 0) {
        this.logger.warn(
          `Failed to get Pgyer app info for ${DistributionType.androidPgyer}: ${response.data?.message || 'Unknown error'}`,
        );
        // Log full response for debugging
        this.logger.debug(`Pgyer API response: ${JSON.stringify(response.data)}`);
        return;
      }

      const appData = response.data.data;
      if (!appData || !appData.buildShortcutUrl) {
        this.logger.warn(
          `No shortcut URL found in Pgyer response for ${DistributionType.androidPgyer}`,
        );
        return;
      }

      // Parse version and build from appData
      let version = '';
      let build: number | null = null;

      // Use buildVersion field (e.g., "3.4.1")
      if (appData.buildVersion) {
        const versionMatch = appData.buildVersion.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          version = versionMatch[1];
        } else {
          version = appData.buildVersion;
        }
      }

      // Use buildVersionNo field for build number (e.g., "627")
      if (appData.buildVersionNo) {
        const buildMatch = appData.buildVersionNo.match(/(\d+)/);
        if (buildMatch) {
          build = parseInt(buildMatch[1], 10);
        }
      }

      if (!version) {
        this.logger.warn(
          `Could not parse version from Pgyer response for ${DistributionType.androidPgyer}`,
        );
        return;
      }

      // Build download page URL from shortcut URL
      const downloadPageUrl = `https://www.pgyer.com/${appData.buildShortcutUrl}`;

      await this.saveDistribution({
        type: DistributionType.androidPgyer,
        url: downloadPageUrl,
        version,
        build,
      });

      const displayVersion = version ? (build ? `${version}+${build}` : version) : 'unknown';
      this.logger.log(
        `✅ Saved ${DistributionType.androidPgyer}: ${downloadPageUrl} (${displayVersion})`,
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Pgyer app not found for ${DistributionType.androidPgyer}`);
      } else {
        this.logger.error(`Error checking ${DistributionType.androidPgyer}: ${error.message}`);
      }
    }
  }

  private async checkAndroidGooglePlay() {
    // Google Play Store link is fixed
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.rwkvzone.chat';

    let version = 'latest';
    const build: number | null = null;

    try {
      // Try to fetch version from Play Store page
      // Note: Google doesn't provide a public API, so we parse the HTML
      const response = await axios.get(playStoreUrl, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      // Try multiple patterns to extract version from HTML
      const html = response.data;

      // Pattern 1: Look for version in AF_initDataCallback (Google Play Store internal data)
      // First, try to find the pattern [["3.3.1"]] directly in the HTML
      const directVersionMatch = html.match(/\[\["(\d+\.\d+\.\d+)"\]\]/);
      if (directVersionMatch && directVersionMatch[1]) {
        version = directVersionMatch[1];
        this.logger.log(
          `✅ Fetched Play Store version from AF_initDataCallback (direct): ${version}`,
        );
      } else {
        // Try to find AF_initDataCallback and extract data field
        const afInitDataMatch = html.match(
          /AF_initDataCallback\s*\([^)]*data:\s*(\[[\s\S]{0,50000}\])\s*[,}]/i,
        );
        if (afInitDataMatch) {
          try {
            const dataStr = afInitDataMatch[1];
            // Try to find version pattern in the data string
            const versionInDataMatch = dataStr.match(/\[\["(\d+\.\d+\.\d+)"\]\]/);
            if (versionInDataMatch && versionInDataMatch[1]) {
              version = versionInDataMatch[1];
              this.logger.log(`✅ Fetched Play Store version from AF_initDataCallback: ${version}`);
            } else {
              // Try a more flexible search for version strings
              const flexibleVersionMatch = dataStr.match(/"(\d+\.\d+\.\d+)"/);
              if (flexibleVersionMatch && flexibleVersionMatch[1]) {
                version = flexibleVersionMatch[1];
                this.logger.log(
                  `✅ Fetched Play Store version from AF_initDataCallback (flexible): ${version}`,
                );
              } else {
                // Try to parse and search recursively
                try {
                  const dataArray = JSON.parse(dataStr);
                  const versionFromData = this.extractVersionFromNestedArray(dataArray);
                  if (versionFromData) {
                    version = versionFromData;
                    this.logger.log(
                      `✅ Fetched Play Store version from AF_initDataCallback (parsed): ${version}`,
                    );
                  }
                } catch (parseError) {
                  // JSON parsing failed, continue to other patterns
                  this.logger.debug(`Failed to parse AF_initDataCallback data: ${parseError}`);
                }
              }
            }
          } catch (e) {
            // Continue to other patterns
            this.logger.debug(`Failed to extract from AF_initDataCallback: ${e}`);
          }
        }
      }

      // Pattern 2: Look for version in JSON-LD structured data
      if (version === 'latest') {
        const jsonLdMatch = html.match(
          /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is,
        );
        if (jsonLdMatch) {
          try {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            if (jsonLd.softwareVersion) {
              version = jsonLd.softwareVersion;
              this.logger.log(`✅ Fetched Play Store version from JSON-LD: ${version}`);
            }
          } catch (e) {
            // Continue to other patterns
          }
        }
      }

      // Pattern 3: Look for version in the page content
      if (version === 'latest') {
        const versionPatterns = [
          /Current Version[^>]*>(\d+\.\d+\.\d+)/i,
          /Version[^>]*>(\d+\.\d+\.\d+)/i,
          /"version":"(\d+\.\d+\.\d+)"/i,
          /versionCode["\s]*:["\s]*(\d+)/i,
          /<div[^>]*>(\d+\.\d+\.\d+)<\/div>[^<]*Current Version/i,
        ];

        for (const pattern of versionPatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].length > 1) {
            // Ensure we have a valid version (not just a single dot)
            version = match[1];
            this.logger.log(`✅ Fetched Play Store version from HTML: ${version}`);
            break;
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to fetch Play Store version: ${error.message}`);
      // Fallback to 'latest' if API call fails
    }

    await this.saveDistribution({
      type: DistributionType.androidGooglePlay,
      url: playStoreUrl,
      version,
      build,
    });

    this.logger.log(
      `✅ Updated ${DistributionType.androidGooglePlay}: Google Play Store link (version: ${version})`,
    );
  }

  /**
   * Recursively extract version number from nested array structure
   * Looks for patterns like [["3.3.1"]] or nested arrays containing semantic version strings
   */
  private extractVersionFromNestedArray(arr: any): string | null {
    if (!Array.isArray(arr)) {
      return null;
    }

    for (const item of arr) {
      if (typeof item === 'string') {
        // Check if it's a semantic version pattern (e.g., "3.3.1")
        const versionMatch = item.match(/^(\d+\.\d+\.\d+)$/);
        if (versionMatch) {
          return versionMatch[1];
        }
      } else if (Array.isArray(item)) {
        // Recursively search in nested arrays
        const result = this.extractVersionFromNestedArray(item);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Compare two semantic versions (e.g., "3.4.0" vs "3.5.0")
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    if (!v1 && !v2) return 0;
    if (!v1) return -1;
    if (!v2) return 1;

    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  }

  /**
   * Get the latest distribution for each type
   * Returns an object where keys are DistributionType and values are the latest record or null
   */
  async getLatestDistributions(): Promise<Record<string, any | null>> {
    try {
      const distributionTypes = Object.values(DistributionType);
      const result: Record<string, any | null> = {};

      for (const type of distributionTypes) {
        try {
          // Get all records for this type
          const records = await this.prisma.distribution.findMany({
            where: { type },
            orderBy: { createdAt: 'desc' },
          });

          if (records.length === 0) {
            result[type] = null;
            continue;
          }

          // Find the record with the latest version
          // Priority: 1. "latest" version (for App Store/Play Store) > 2. Highest semantic version > 3. Highest build number
          let latestRecord = records[0];
          let latestVersion = (latestRecord as any).version || '';
          let latestBuild = (latestRecord as any).build || null;

          // Step 1: If any record has "latest" version, prefer it (for App Store/Play Store links)
          const latestVersionRecord = records.find((r) => (r as any).version === 'latest');
          if (latestVersionRecord) {
            latestRecord = latestVersionRecord;
            latestVersion = 'latest';
            latestBuild = (latestVersionRecord as any).build || null;
          } else {
            // Step 2: Find the record with the highest semantic version
            // Step 3: If versions are equal, pick the one with the highest build number
            for (const record of records) {
              const recordVersion = (record as any).version || '';
              const recordBuild = (record as any).build || null;

              // Skip "latest" version in comparison (already handled above)
              if (recordVersion === 'latest') {
                continue;
              }

              // Skip empty or invalid versions
              if (!recordVersion) {
                continue;
              }

              const versionCompare = this.compareVersions(recordVersion, latestVersion);
              if (versionCompare > 0) {
                // Newer semantic version found - this is definitely the latest
                latestRecord = record;
                latestVersion = recordVersion;
                latestBuild = recordBuild;
              } else if (versionCompare === 0) {
                // Same semantic version, compare build numbers
                // If both have build numbers, pick the higher one
                // If only one has a build number, prefer the one with build number
                if (recordBuild !== null && latestBuild !== null) {
                  if (recordBuild > latestBuild) {
                    latestRecord = record;
                    latestBuild = recordBuild;
                  }
                } else if (recordBuild !== null && latestBuild === null) {
                  // Prefer record with build number over one without
                  latestRecord = record;
                  latestBuild = recordBuild;
                }
                // If latestBuild has a value but recordBuild is null, keep latestRecord
              }
            }
          }

          result[type] = {
            id: latestRecord.id,
            type: latestRecord.type,
            url: latestRecord.url,
            version: (latestRecord as any).version,
            build: (latestRecord as any).build,
            createdAt: latestRecord.createdAt,
            updatedAt: latestRecord.updatedAt,
          };
        } catch (error: any) {
          // If database query fails (e.g., table doesn't exist, connection error), return null for this type
          this.logger.warn(`Failed to fetch records for type ${type}: ${error.message}`);
          result[type] = null;
        }
      }

      return result;
    } catch (error: any) {
      // If there's a fatal error (e.g., Prisma not connected, database doesn't exist), return empty object
      this.logger.error(`Fatal error in getLatestDistributions: ${error.message}`, error.stack);
      // Return empty object instead of throwing - this allows the API to return 200 with empty data
      return {};
    }
  }
}
