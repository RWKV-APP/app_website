import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { DistributionModule } from './distribution/distribution.module';
import { EvalModule } from './eval/eval.module';
import { RemoteConfigModule } from './remote-config/remote-config.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DistributionModule,
    RemoteConfigModule,
    AdminAuthModule,
    EvalModule,
    TelemetryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
