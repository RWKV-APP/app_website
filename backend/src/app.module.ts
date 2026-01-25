import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { DistributionService } from './distribution/distribution.service';
import { DistributionController } from './distribution/distribution.controller';
import { ReleaseNotesService } from './distribution/release-notes.service';
import { ReleaseNotesController } from './distribution/release-notes.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController, DistributionController, ReleaseNotesController],
  providers: [AppService, PrismaService, DistributionService, ReleaseNotesService],
})
export class AppModule {}
