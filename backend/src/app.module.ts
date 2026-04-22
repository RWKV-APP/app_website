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
import { EvalService } from './eval/eval.service';
import { EvalAdminController } from './eval/eval.admin.controller';
import { EvalPublicController } from './eval/eval.public.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { TelemetryAdminController } from './telemetry/telemetry.admin.controller';
import { TelemetryService } from './telemetry/telemetry.service';

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
    EvalAdminController,
    EvalPublicController,
    TelemetryController,
    TelemetryAdminController,
  ],
  providers: [
    AppService,
    PrismaService,
    DistributionService,
    ReleaseNotesService,
    RemoteConfigService,
    AdminAuthService,
    AdminAuthGuard,
    EvalService,
    TelemetryService,
  ],
})
export class AppModule {}
