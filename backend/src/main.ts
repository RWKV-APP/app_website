import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 开启 CORS，允许前端跨域请求
  app.enableCors();

  await app.listen(3462);
  logger.log('Backend server started on port 3462');
}

void bootstrap();
