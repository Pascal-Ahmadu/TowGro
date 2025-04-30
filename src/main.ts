import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import 'reflect-metadata';  // Add this as FIRST import
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { MetricsService } from './monitoring/metrics.service';
// Add this import for GlobalExceptionFilter
import { GlobalExceptionFilter } from './common/middleware/error-handler.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Setup Swagger documentation
  // Add to your bootstrap function

  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription(
      'The complete API documentation for the authentication service',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('payments', 'Payment processing endpoints')
    .addTag('tracking', 'Location tracking endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Security middleware
  app.use(helmet());

  // Compression
  app.use(compression());

  // Get metrics service for global exception handling
  const metricsService = app.get(MetricsService);

  // Add global exception filter to track errors in metrics
  app.useGlobalFilters(new GlobalExceptionFilter(metricsService));

  // Start the server
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap();
