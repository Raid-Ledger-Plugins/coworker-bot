import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { CoworkerConfigService } from './config/coworker.config.js';
import { createLogger, ManagedLogger } from './logging/logger.factory.js';
import { COWORKER_MANIFEST } from './manifest.js';

async function bootstrap(): Promise<void> {
  const cfg = new CoworkerConfigService();
  const managed = createLogger(cfg.config);

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
    logger: managed.logger,
  });
  app.useLogger(managed.logger);

  const logger = new Logger('Bootstrap');
  logger.log(`Starting ${COWORKER_MANIFEST.name} v${COWORKER_MANIFEST.version}`);

  app.enableShutdownHooks();
  process.on('SIGINT', () => void shutdown(app, managed, logger, 'SIGINT'));
  process.on('SIGTERM', () => void shutdown(app, managed, logger, 'SIGTERM'));

  // Discord's gateway/voice websockets can emit 'error' with no listener
  // attached (e.g. "Opening handshake has timed out" mid-reconnect), which
  // would otherwise kill the process. Log and keep running: discord.js
  // reconnects on its own, and Docker's restart policy stays the backstop
  // if the process ever ends up truly wedged.
  process.on('uncaughtException', (err) => {
    logger.error(
      `uncaught exception: ${String(err)}`,
      err instanceof Error ? err.stack : undefined,
    );
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `unhandled rejection: ${String(reason)}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });
}

async function shutdown(
  app: { close(): Promise<void> },
  managed: ManagedLogger,
  logger: Logger,
  signal: string,
): Promise<void> {
  logger.log(`Received ${signal}, shutting down...`);
  try {
    await app.close();
  } finally {
    await managed.close();
    process.exit(0);
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', err);
  process.exit(1);
});
