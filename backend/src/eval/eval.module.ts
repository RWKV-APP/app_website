import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EvalAdminController } from './eval.admin.controller';
import { EvalPublicController } from './eval.public.controller';
import { EvalService } from './eval.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [EvalAdminController, EvalPublicController],
  providers: [EvalService],
})
export class EvalModule {}
