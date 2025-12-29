import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 开启 CORS，允许前端跨域请求
  app.enableCors();

  await app.listen(3462);
}

void bootstrap();
