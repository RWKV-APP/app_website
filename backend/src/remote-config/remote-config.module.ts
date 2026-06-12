import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RemoteConfigAdminController } from './remote-config.admin.controller';
import { RemoteConfigPublicController } from './remote-config.public.controller';
import { RemoteConfigService } from './remote-config.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AdminAuthModule)],
  controllers: [RemoteConfigPublicController, RemoteConfigAdminController],
  providers: [RemoteConfigService],
  exports: [RemoteConfigService],
})
export class RemoteConfigModule {}
