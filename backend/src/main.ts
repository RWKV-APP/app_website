import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');
  const nodeEnv = process.env.NODE_ENV || 'development';
  const host = process.env.HOST || '0.0.0.0';
  const defaultPort = nodeEnv === 'production' ? '3462' : '3001';
  const port = Number.parseInt(process.env.PORT || defaultPort, 10);

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // 开启 CORS，允许前端跨域请求
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(port, host);
  logger.log(`Backend server started on ${host}:${port}`);
}

void bootstrap();
