import { Controller, Get, Query, HttpStatus, HttpException, Logger } from '@nestjs/common';
import { ReleaseNotesService } from './release-notes.service';

@Controller('distributions')
export class ReleaseNotesController {
  private readonly logger = new Logger(ReleaseNotesController.name);

  constructor(private readonly releaseNotesService: ReleaseNotesService) {}

  @Get('release-notes')
  async getReleaseNotes(
    @Query('build') buildParam: string,
    @Query('version') versionParam?: string,
  ) {
    // Validate build parameter
    if (!buildParam) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Build number is required',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Parse build number
    const buildNumber = parseInt(buildParam, 10);
    if (isNaN(buildNumber) || buildNumber <= 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid build number. Must be a positive integer',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get release notes with optional version for fallback
    this.logger.debug(
      `Getting release notes for build ${buildNumber}${versionParam ? ` with version ${versionParam}` : ' (no version provided)'}`,
    );
    const result = await this.releaseNotesService.getReleaseNotes({
      buildNumber,
      version: versionParam,
    });

    // If file doesn't exist, return empty content instead of 404
    // This allows the app to handle missing release notes gracefully
    if (result === null) {
      this.logger.debug(`Release notes not found for build ${buildNumber}, returning empty content`);
      return {
        build: buildNumber,
        version: null,
        content: '',
      };
    }

    return result;
  }

  @Get('release-notes/all')
  async getAllReleaseNotes() {
    this.logger.debug('Getting all release notes');
    const result = await this.releaseNotesService.getAllReleaseNotes();
    return result;
  }
}
