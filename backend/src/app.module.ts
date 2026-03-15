import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { DistributionService } from './distribution/distribution.service';
import { DistributionController } from './distribution/distribution.controller';
import { ReleaseNotesService } from './distribution/release-notes.service';
import { ReleaseNotesController } from './distribution/release-notes.controller';
import { RemoteConfigPublicController } from './remote-config/remote-config.public.controller';
import { RemoteConfigService } from './remote-config/remote-config.service';
import { RemoteConfigAdminController } from './remote-config/remote-config.admin.controller';
import { AdminAuthService } from './admin-auth/admin-auth.service';
import { AdminAuthController } from './admin-auth/admin-auth.controller';
import { AdminAuthGuard } from './admin-auth/admin-auth.guard';
import { WebhookController } from './webhook/webhook.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    AppController,
    DistributionController,
    ReleaseNotesController,
    RemoteConfigPublicController,
    RemoteConfigAdminController,
    AdminAuthController,
    WebhookController,
  ],
  providers: [
    AppService,
    PrismaService,
    DistributionService,
    ReleaseNotesService,
    RemoteConfigService,
    AdminAuthService,
    AdminAuthGuard,
  ],
})
export class AppModule {}
