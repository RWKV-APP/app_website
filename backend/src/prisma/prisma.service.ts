import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database');
    } catch (error: any) {
      this.logger.error(`Failed to connect to database: ${error.message}`, error.stack);
      // Don't throw - allow service to start even if database connection fails
      // This allows the app to start and handle errors gracefully
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Prisma disconnected from database');
    } catch (error: any) {
      this.logger.error(`Error disconnecting from database: ${error.message}`, error.stack);
    }
  }
}
