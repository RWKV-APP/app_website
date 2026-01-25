import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ReleaseNotesService {
  private readonly logger = new Logger(ReleaseNotesService.name);
  private readonly releaseNotesDir: string;

  constructor() {
    // Resolve the release notes directory relative to the backend root
    // This ensures we're always reading from the correct location
    const backendRoot = path.resolve(__dirname, '../../');
    this.releaseNotesDir = path.join(backendRoot, 'data', 'release-notes');
    this.logger.log(`Release notes directory: ${this.releaseNotesDir}`);
  }

  /**
   * Map locale to language folder name
   * @param locale - Locale string (e.g., "zh-CN", "en", "ja")
   * @returns Language folder name (e.g., "zh-Hans", "en", "ja")
   */
  private getLanguageFolder(locale: string): string {
    if (locale.startsWith('zh-CN') || locale === 'zh') {
      return 'zh-Hans'; // Simplified Chinese
    } else if (locale.startsWith('zh-TW') || locale.startsWith('zh-HK') || locale.startsWith('zh-MO')) {
      return 'zh-Hant'; // Traditional Chinese
    } else if (locale === 'en') {
      return 'en';
    } else if (locale === 'ja') {
      return 'ja';
    } else if (locale === 'ko') {
      return 'ko';
    } else if (locale === 'ru') {
      return 'ru';
    } else {
      // Default to Simplified Chinese for unknown locales
      return 'zh-Hans';
    }
  }

  /**
   * Get release notes directory for a specific language
   * @param locale - Locale string
   * @returns Full path to language-specific release notes directory
   */
  private getLanguageDir(locale: string): string {
    const langFolder = this.getLanguageFolder(locale);
    return path.join(this.releaseNotesDir, langFolder);
  }

  /**
   * Generate fallback versions for a given semantic version
   * Example: "3.7.4" -> ["3.7.4", "3.7.3", "3.7.2", "3.7.1", "3.7.0"]
   */
  private generateFallbackVersions(version: string): string[] {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      // If version format is incorrect, return only the original version
      return [version];
    }

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const patch = parseInt(match[3], 10);

    const versions: string[] = [];
    for (let p = patch; p >= 0; p--) {
      versions.push(`${major}.${minor}.${p}`);
    }

    return versions;
  }

  /**
   * Find release notes by version with fallback
   * @param options - Options object with fallbackVersions and locale
   * @returns Object with build number, version, and content, or null if no file found
   */
  private async findReleaseNotesByVersion(options: {
    fallbackVersions: string[];
    locale?: string;
  }): Promise<{
    build: number;
    version: string;
    content: string;
  } | null> {
    const { fallbackVersions, locale = 'zh-CN' } = options;
    
    // Get language-specific directory
    const langDir = this.getLanguageDir(locale);
    try {
      // Check if language directory exists
      try {
        await fs.access(langDir);
      } catch {
        // Language directory doesn't exist, fallback to zh-Hans
        this.logger.debug(
          `Language directory ${langDir} not found, falling back to zh-Hans`,
        );
        const fallbackLangDir = this.getLanguageDir('zh-CN');
        try {
          await fs.access(fallbackLangDir);
          const files = await fs.readdir(fallbackLangDir);
          const matchingFiles: Array<{
            fileName: string;
            buildNumber: number;
            version: string;
            patch: number;
          }> = [];

          // Scan all files and find matches
          for (const file of files) {
            const match = file.match(/^(\d+)-(.+)\.md$/);
            if (match) {
              const fileBuildNumber = parseInt(match[1], 10);
              const fileVersion = match[2];

              // Check if this version is in our fallback list
              if (fallbackVersions.includes(fileVersion)) {
                // Parse patch version for sorting
                const versionMatch = fileVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
                const patch = versionMatch ? parseInt(versionMatch[3], 10) : 0;

                matchingFiles.push({
                  fileName: file,
                  buildNumber: fileBuildNumber,
                  version: fileVersion,
                  patch,
                });
              }
            }
          }

          if (matchingFiles.length === 0) {
            return null;
          }

          // Sort by patch version (descending) and then by build number (descending)
          matchingFiles.sort((a, b) => {
            if (a.patch !== b.patch) {
              return b.patch - a.patch; // Higher patch first
            }
            return b.buildNumber - a.buildNumber; // Higher build number first
          });

          // Use the first (highest patch version) match
          const bestMatch = matchingFiles[0];
          const filePath = path.join(fallbackLangDir, bestMatch.fileName);

          // Security check
          const resolvedPath = path.resolve(filePath);
          const resolvedDir = path.resolve(fallbackLangDir);
          if (!resolvedPath.startsWith(resolvedDir)) {
            this.logger.error(
              `Path traversal attempt detected: ${filePath} resolves to ${resolvedPath}`,
            );
            return null;
          }

          const content = await fs.readFile(filePath, 'utf-8');

          this.logger.debug(
            `Found release notes via fallback: build ${bestMatch.buildNumber}, version ${bestMatch.version}`,
          );

          return {
            build: bestMatch.buildNumber,
            version: bestMatch.version,
            content: content.trim(),
          };
        } catch {
          return null;
        }
      }
      
      const files = await fs.readdir(langDir);
      const matchingFiles: Array<{
        fileName: string;
        buildNumber: number;
        version: string;
        patch: number;
      }> = [];

      // Scan all files and find matches
      for (const file of files) {
        const match = file.match(/^(\d+)-(.+)\.md$/);
        if (match) {
          const fileBuildNumber = parseInt(match[1], 10);
          const fileVersion = match[2];

          // Check if this version is in our fallback list
          if (fallbackVersions.includes(fileVersion)) {
            // Parse patch version for sorting
            const versionMatch = fileVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
            const patch = versionMatch ? parseInt(versionMatch[3], 10) : 0;

            matchingFiles.push({
              fileName: file,
              buildNumber: fileBuildNumber,
              version: fileVersion,
              patch,
            });
          }
        }
      }

      if (matchingFiles.length === 0) {
        return null;
      }

      // Sort by patch version (descending) and then by build number (descending)
      matchingFiles.sort((a, b) => {
        if (a.patch !== b.patch) {
          return b.patch - a.patch; // Higher patch first
        }
        return b.buildNumber - a.buildNumber; // Higher build number first
      });

      // Use the first (highest patch version) match
      const bestMatch = matchingFiles[0];
      const filePath = path.join(langDir, bestMatch.fileName);

      // Security check
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(langDir);
      if (!resolvedPath.startsWith(resolvedDir)) {
        this.logger.error(
          `Path traversal attempt detected: ${filePath} resolves to ${resolvedPath}`,
        );
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');

      this.logger.debug(
        `Found release notes via fallback: build ${bestMatch.buildNumber}, version ${bestMatch.version}`,
      );

      return {
        build: bestMatch.buildNumber,
        version: bestMatch.version,
        content: content.trim(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error finding release notes by version: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get release notes for a specific build number with optional version fallback
   * @param buildNumber - The build number to get release notes for
   * @param version - Optional version string for fallback (e.g., "3.7.4")
   * @param locale - Optional locale string (e.g., "en", "zh-CN"). Defaults to "zh-CN"
   * @returns Object with build number, version, and content, or null if file doesn't exist
   */
  async getReleaseNotes(options: {
    buildNumber: number;
    version?: string;
    locale?: string;
  }): Promise<{
    build: number;
    version: string | null;
    content: string;
  } | null> {
    const { buildNumber, version: requestedVersion, locale = 'zh-CN' } = options;
    
    // Get language-specific directory
    const langDir = this.getLanguageDir(locale);

    // Validate buildNumber is a positive integer
    if (!Number.isInteger(buildNumber) || buildNumber <= 0) {
      this.logger.warn(`Invalid build number: ${buildNumber}`);
      return null;
    }

      // Try to find file with new format: {buildNumber}-{version}.md in language-specific directory
      try {
        // Check if language directory exists
        try {
          await fs.access(langDir);
        } catch {
          // Language directory doesn't exist, fallback to zh-Hans
          this.logger.debug(
            `Language directory ${langDir} not found, falling back to zh-Hans`,
          );
          const fallbackLangDir = this.getLanguageDir('zh-CN');
          try {
            await fs.access(fallbackLangDir);
            const files = await fs.readdir(fallbackLangDir);
            const matchingFiles = files.filter((file) => {
              const match = file.match(/^(\d+)-(.+)\.md$/);
              if (match) {
                const fileBuildNumber = parseInt(match[1], 10);
                return fileBuildNumber === buildNumber;
              }
              return false;
            });
            
            if (matchingFiles.length > 0) {
              const fileName = matchingFiles[0];
              const filePath = path.join(fallbackLangDir, fileName);
              const resolvedPath = path.resolve(filePath);
              const resolvedDir = path.resolve(fallbackLangDir);
              if (resolvedPath.startsWith(resolvedDir)) {
                const content = await fs.readFile(filePath, 'utf-8');
                const filenameMatch = fileName.match(/^(\d+)-(.+)\.md$/);
                const version = filenameMatch ? filenameMatch[2] : null;
                this.logger.debug(
                  `Using zh-Hans fallback for build ${buildNumber} (requested ${locale})`,
                );
                return {
                  build: buildNumber,
                  version,
                  content: content.trim(),
                };
              }
            }
          } catch {
            // Fallback directory also doesn't exist
          }
          return null;
        }
        
        const files = await fs.readdir(langDir);
        const matchingFiles = files.filter((file) => {
          // Match pattern: {buildNumber}-{version}.md
          const match = file.match(/^(\d+)-(.+)\.md$/);
          if (match) {
            const fileBuildNumber = parseInt(match[1], 10);
            return fileBuildNumber === buildNumber;
          }
          return false;
        });

      if (matchingFiles.length === 0) {
        // If no matching file found, try fallback to zh-Hans (Simplified Chinese)
        if (locale !== 'zh-CN') {
          this.logger.debug(
            `No file found for build ${buildNumber} in ${langDir}, trying zh-Hans fallback`,
          );
          const fallbackLangDir = this.getLanguageDir('zh-CN');
          try {
            await fs.access(fallbackLangDir);
            const files = await fs.readdir(fallbackLangDir);
            const fallbackFiles = files.filter((file) => {
              const match = file.match(/^(\d+)-(.+)\.md$/);
              if (match) {
                const fileBuildNumber = parseInt(match[1], 10);
                return fileBuildNumber === buildNumber;
              }
              return false;
            });
            
            if (fallbackFiles.length > 0) {
              const filePath = path.join(fallbackLangDir, fallbackFiles[0]);
              const resolvedPath = path.resolve(filePath);
              const resolvedDir = path.resolve(fallbackLangDir);
              if (resolvedPath.startsWith(resolvedDir)) {
                const content = await fs.readFile(filePath, 'utf-8');
                const filenameMatch = fallbackFiles[0].match(/^(\d+)-(.+)\.md$/);
                const version = filenameMatch ? filenameMatch[2] : null;
                this.logger.debug(
                  `Using zh-Hans fallback for build ${buildNumber} (requested ${locale})`,
                );
                return {
                  build: buildNumber,
                  version,
                  content: content.trim(),
                };
              }
            }
          } catch {
            // Fallback directory doesn't exist
          }
        }
        
        // Fallback: try old format {buildNumber}.md for backward compatibility (in root directory)
        const oldFormatFile = `${buildNumber}.md`;
        try {
          const oldFilePath = path.join(this.releaseNotesDir, oldFormatFile);
          await fs.access(oldFilePath);
          const content = await fs.readFile(oldFilePath, 'utf-8');
          this.logger.debug(
            `Found release notes in old format for build ${buildNumber}`,
          );
          return {
            build: buildNumber,
            version: null,
            content: content.trim(),
          };
        } catch {
          this.logger.debug(
            `Release notes file not found for build ${buildNumber}`,
          );

          // Try fallback if version is provided
          if (requestedVersion && requestedVersion.trim().length > 0) {
            this.logger.debug(
              `Attempting fallback for build ${buildNumber} with version ${requestedVersion}`,
            );
            const fallbackVersions = this.generateFallbackVersions(requestedVersion);
            this.logger.debug(
              `Generated fallback versions: ${fallbackVersions.join(', ')}`,
            );
            const fallbackResult = await this.findReleaseNotesByVersion({
              fallbackVersions,
              locale,
            });

            if (fallbackResult) {
              this.logger.debug(
                `Found release notes via fallback: build ${fallbackResult.build}, version ${fallbackResult.version}`,
              );
              return fallbackResult;
            }

            this.logger.debug(
              `No release notes found via fallback for version ${requestedVersion}`,
            );
          } else {
            this.logger.debug(
              `No version provided for fallback (version: ${requestedVersion})`,
            );
          }

          return null;
        }
      }

      if (matchingFiles.length > 1) {
        this.logger.warn(
          `Multiple files found for build ${buildNumber}: ${matchingFiles.join(', ')}. Using the first one.`,
        );
      }

      // Use the first matching file
      const fileName = matchingFiles[0];
      const filePath = path.join(langDir, fileName);

      // Security check: ensure the resolved path is within the release notes directory
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(langDir);
      if (!resolvedPath.startsWith(resolvedDir)) {
        this.logger.error(
          `Path traversal attempt detected: ${filePath} resolves to ${resolvedPath}`,
        );
        return null;
      }

      // Extract version from filename: {buildNumber}-{version}.md
      const filenameMatch = fileName.match(/^(\d+)-(.+)\.md$/);
      const version = filenameMatch ? filenameMatch[2] : null;

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      this.logger.debug(
        `Successfully read release notes for build ${buildNumber}, version ${version}`,
      );

      return {
        build: buildNumber,
        version,
        content: content.trim(),
      };
    } catch (error: unknown) {
      // Directory read error or other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error reading release notes for build ${buildNumber}: ${errorMessage}`,
      );
      return null;
    }
  }

  /**
   * Get all release notes with version filtering
   * Only returns the latest patch version for each major.minor version
   * Only includes versions: 3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 and 1.6, 1.7, 1.8, 1.9
   * @param locale - Optional locale string (e.g., "en", "zh-CN"). Defaults to "zh-CN"
   * @returns Array of release notes sorted by version (descending)
   */
  async getAllReleaseNotes(options?: { locale?: string }): Promise<
    Array<{
      build: number;
      version: string;
      content: string;
    }>
  > {
    const locale = options?.locale || 'zh-CN';
    
    // Get language-specific directory
    const langDir = this.getLanguageDir(locale);
    try {
      // Check if language directory exists
      try {
        await fs.access(langDir);
      } catch {
        // Language directory doesn't exist, fallback to zh-Hans
        this.logger.debug(
          `Language directory ${langDir} not found, falling back to zh-Hans`,
        );
        const fallbackLangDir = this.getLanguageDir('zh-CN');
        try {
          await fs.access(fallbackLangDir);
          const files = await fs.readdir(fallbackLangDir);
          const releaseNotes: Array<{
            fileName: string;
            buildNumber: number;
            version: string;
            major: number;
            minor: number;
            patch: number;
          }> = [];

          // Parse all files
          for (const file of files) {
            const match = file.match(/^(\d+)-(.+)\.md$/);
            if (match) {
              const buildNumber = parseInt(match[1], 10);
              const version = match[2];
              
              const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

              if (versionMatch) {
                const major = parseInt(versionMatch[1], 10);
                const minor = parseInt(versionMatch[2], 10);
                const patch = parseInt(versionMatch[3], 10);

                // Filter by allowed version ranges
                const allowedVersions = [
                  { major: 3, minor: 0 },
                  { major: 3, minor: 1 },
                  { major: 3, minor: 2 },
                  { major: 3, minor: 3 },
                  { major: 3, minor: 4 },
                  { major: 3, minor: 5 },
                  { major: 3, minor: 6 },
                  { major: 3, minor: 7 },
                  { major: 1, minor: 6 },
                  { major: 1, minor: 7 },
                  { major: 1, minor: 8 },
                  { major: 1, minor: 9 },
                ];

                const isAllowed = allowedVersions.some(
                  (allowed) => allowed.major === major && allowed.minor === minor,
                );

                if (isAllowed) {
                  releaseNotes.push({
                    fileName: file,
                    buildNumber,
                    version,
                    major,
                    minor,
                    patch,
                  });
                }
              }
            }
          }

          // Group by major.minor and keep only the highest patch version
          const fallbackVersionMap = new Map<string, typeof releaseNotes[0]>();
          for (const note of releaseNotes) {
            const key = `${note.major}.${note.minor}`;
            const existing = fallbackVersionMap.get(key);

            if (!existing || note.patch > existing.patch) {
              fallbackVersionMap.set(key, note);
            } else if (note.patch === existing.patch && note.buildNumber > existing.buildNumber) {
              // If patch versions are equal, prefer higher build number
              fallbackVersionMap.set(key, note);
            }
          }

          // Convert to array and read file contents
          const fallbackResult: Array<{
            build: number;
            version: string;
            content: string;
          }> = [];

          for (const note of fallbackVersionMap.values()) {
            const filePath = path.join(fallbackLangDir, note.fileName);

            // Security check
            const resolvedPath = path.resolve(filePath);
            const resolvedDir = path.resolve(fallbackLangDir);
            if (!resolvedPath.startsWith(resolvedDir)) {
              this.logger.error(
                `Path traversal attempt detected: ${filePath} resolves to ${resolvedPath}`,
              );
              continue;
            }

            try {
              const content = await fs.readFile(filePath, 'utf-8');
              fallbackResult.push({
                build: note.buildNumber,
                version: note.version,
                content: content.trim(),
              });
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`Error reading file ${note.fileName}: ${errorMessage}`);
            }
          }

          // Sort by version (descending)
          fallbackResult.sort((a, b) => {
            const aParts = a.version.split('.').map(Number);
            const bParts = b.version.split('.').map(Number);

            // Compare major
            if (aParts[0] !== bParts[0]) {
              return bParts[0] - aParts[0];
            }
            // Compare minor
            if (aParts[1] !== bParts[1]) {
              return bParts[1] - aParts[1];
            }
            // Compare patch
            return bParts[2] - aParts[2];
          });

          this.logger.debug(`Returning ${fallbackResult.length} filtered release notes (fallback to zh-Hans)`);
          return fallbackResult;
        } catch {
          // Fallback directory also doesn't exist
          return [];
        }
      }
      
      const files = await fs.readdir(langDir);
      const releaseNotes: Array<{
        fileName: string;
        buildNumber: number;
        version: string;
        major: number;
        minor: number;
        patch: number;
      }> = [];

      // Parse all files
      for (const file of files) {
        const match = file.match(/^(\d+)-(.+)\.md$/);
        if (match) {
          const buildNumber = parseInt(match[1], 10);
          const version = match[2];
          
          const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

          if (versionMatch) {
            const major = parseInt(versionMatch[1], 10);
            const minor = parseInt(versionMatch[2], 10);
            const patch = parseInt(versionMatch[3], 10);

            // Filter by allowed version ranges
            const allowedVersions = [
              { major: 3, minor: 0 },
              { major: 3, minor: 1 },
              { major: 3, minor: 2 },
              { major: 3, minor: 3 },
              { major: 3, minor: 4 },
              { major: 3, minor: 5 },
              { major: 3, minor: 6 },
              { major: 3, minor: 7 },
              { major: 1, minor: 6 },
              { major: 1, minor: 7 },
              { major: 1, minor: 8 },
              { major: 1, minor: 9 },
            ];

            const isAllowed = allowedVersions.some(
              (allowed) => allowed.major === major && allowed.minor === minor,
            );

            if (isAllowed) {
              releaseNotes.push({
                fileName: file,
                buildNumber,
                version,
                major,
                minor,
                patch,
              });
            }
          }
        }
      }

      // Group by major.minor and keep only the highest patch version
      const versionMap = new Map<string, typeof releaseNotes[0]>();
      for (const note of releaseNotes) {
        const key = `${note.major}.${note.minor}`;
        const existing = versionMap.get(key);

        if (!existing || note.patch > existing.patch) {
          versionMap.set(key, note);
        } else if (note.patch === existing.patch && note.buildNumber > existing.buildNumber) {
          // If patch versions are equal, prefer higher build number
          versionMap.set(key, note);
        }
      }

      // Convert to array and read file contents
      const result: Array<{
        build: number;
        version: string;
        content: string;
      }> = [];

      for (const note of versionMap.values()) {
        const filePath = path.join(langDir, note.fileName);

        // Security check
        const resolvedPath = path.resolve(filePath);
        const resolvedDir = path.resolve(langDir);
        if (!resolvedPath.startsWith(resolvedDir)) {
          this.logger.error(
            `Path traversal attempt detected: ${filePath} resolves to ${resolvedPath}`,
          );
          continue;
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          result.push({
            build: note.buildNumber,
            version: note.version,
            content: content.trim(),
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error reading file ${note.fileName}: ${errorMessage}`);
        }
      }

      // Sort by version (descending)
      result.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);

        // Compare major
        if (aParts[0] !== bParts[0]) {
          return bParts[0] - aParts[0];
        }
        // Compare minor
        if (aParts[1] !== bParts[1]) {
          return bParts[1] - aParts[1];
        }
        // Compare patch
        return bParts[2] - aParts[2];
      });

      this.logger.debug(`Returning ${result.length} filtered release notes`);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting all release notes: ${errorMessage}`);
      return [];
    }
  }
}
