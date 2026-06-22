import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Sirve las imágenes subidas en /uploads/<archivo> (fuera del prefijo /api).
  // Incluye los escudos de equipos predefinidos en /uploads/preset-teams/.
  app.useStaticAssets(resolve(uploadDir), { prefix: '/uploads' });
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port);
  console.log(`🚀 Gravity API en http://localhost:${port}/api`);
}
bootstrap();
