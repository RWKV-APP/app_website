import { BadRequestException, Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { RemoteConfigService } from './remote-config.service';

@Controller()
export class RemoteConfigPublicController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  @Get('get-demo-config')
  async getDemoConfig(@Req() request: Request) {
    const buildNumber = this.remoteConfigService.parseBuildHeader(
      request.headers['application-build-number'],
    );

    const record = await this.remoteConfigService.getDemoConfigForBuild(buildNumber);
    if (!record) {
      return {
        success: false,
        message: 'No published app config found.',
        data: null,
      };
    }

    return {
      success: true,
      message: `Loaded ${record.fileName}`,
      data: this.remoteConfigService.parseContent(record.content),
    };
  }

  @Get('suggestions.json')
  async getSuggestions() {
    const suggestions = await this.remoteConfigService.getSuggestionsConfig();
    if (!suggestions) {
      throw new BadRequestException('No published suggestions.json found');
    }
    return suggestions;
  }
}
