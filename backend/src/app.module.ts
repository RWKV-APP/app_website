import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { DistributionService } from './distribution/distribution.service';
import { DistributionController } from './distribution/distribution.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController, DistributionController],
  providers: [AppService, PrismaService, DistributionService],
})
export class AppModule {}
