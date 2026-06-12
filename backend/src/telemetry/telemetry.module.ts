import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TelemetryAdminController } from './telemetry.admin.controller';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [TelemetryController, TelemetryAdminController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
