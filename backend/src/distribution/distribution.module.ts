import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookController } from '../webhook/webhook.controller';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';
import { ReleaseNotesController } from './release-notes.controller';
import { ReleaseNotesService } from './release-notes.service';

@Module({
  imports: [PrismaModule],
  controllers: [DistributionController, ReleaseNotesController, WebhookController],
  providers: [DistributionService, ReleaseNotesService],
  exports: [DistributionService],
})
export class DistributionModule {}
