import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RwkvChatController } from './rwkv-chat.controller';
import { RwkvChatService } from './rwkv-chat.service';

@Module({
  imports: [AdminAuthModule, PrismaModule],
  controllers: [RwkvChatController],
  providers: [RwkvChatService],
})
export class RwkvChatModule {}
