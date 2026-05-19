import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { COWORKER_MANIFEST } from './manifest.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  logger.log(
    `Starting ${COWORKER_MANIFEST.name} v${COWORKER_MANIFEST.version}`,
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  process.on('SIGINT', () => void shutdown(app, logger, 'SIGINT'));
  process.on('SIGTERM', () => void shutdown(app, logger, 'SIGTERM'));
}

async function shutdown(
  app: { close(): Promise<void> },
  logger: Logger,
  signal: string,
): Promise<void> {
  logger.log(`Received ${signal}, shutting down...`);
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', err);
  process.exit(1);
});
