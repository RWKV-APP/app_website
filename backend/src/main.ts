import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

// Load .env file
config({ path: resolve(__dirname, '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set global prefix for API routes
  app.setGlobalPrefix('api');

  // Serve static files from public directory (frontend build output)
  const publicPath = join(__dirname, '..', 'public');
  const indexPath = join(publicPath, 'index.html');

  if (existsSync(publicPath)) {
    logger.log(`Serving static files from: ${publicPath}`);

    // Serve static assets (CSS, JS, images, etc.) - must be before fallback
    app.useStaticAssets(publicPath, {
      index: false,
      prefix: '/',
    });

    // Fallback to index.html for all non-API routes (client-side routing)
    // This must be registered after all routes
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API routes and static assets
      if (req.path.startsWith('/api') || req.path.startsWith('/_next') || req.path.includes('.')) {
        return next();
      }

      // Serve index.html for all other routes
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  } else {
    logger.warn(`Public directory not found: ${publicPath}`);
    logger.warn('Frontend build output not found. Run "pnpm deploy" first.');
  }

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  logger.log(`Application is running on: http://${host}:${port}`);
  logger.log(`API endpoints available at: http://${host}:${port}/api`);
}

bootstrap();
