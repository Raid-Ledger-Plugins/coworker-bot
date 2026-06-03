import { ConsoleLogger, LoggerService, LogLevel } from '@nestjs/common';
import * as fs from 'node:fs';
import { createStream } from 'rotating-file-stream';
import { CoworkerConfig } from '../config/coworker.config.js';
import { FileTeeLogger } from './file-tee-logger.js';

/** Nest log levels in ascending severity. */
const LEVEL_ORDER: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

export interface ManagedLogger {
  logger: LoggerService;
  /** Flush and close the file sink (no-op when logging only to stdout). */
  close(): Promise<void>;
}

/**
 * Builds the application logger. With no `LOG_DIR` (local dev) it's a plain
 * stdout {@link ConsoleLogger}; with `LOG_DIR` set (production / Fly) it also
 * tees a filtered, daily-rotated copy to `<LOG_DIR>/coworker.log`, keeping
 * `LOG_KEEP_DAYS` files — the Node analog of Stella's TimedRotatingFileHandler.
 */
export function createLogger(cfg: CoworkerConfig): ManagedLogger {
  const logLevels = levelsFor(cfg.logLevel);

  if (!cfg.logDir) {
    return {
      logger: new ConsoleLogger('Coworker', { logLevels }),
      close: async () => undefined,
    };
  }

  fs.mkdirSync(cfg.logDir, { recursive: true });
  const stream = createStream('coworker.log', {
    path: cfg.logDir,
    interval: '1d',
    intervalBoundary: true,
    intervalUTC: true,
    maxFiles: cfg.logKeepDays,
    encoding: 'utf8',
  });

  return {
    logger: new FileTeeLogger(stream, logLevels),
    close: () =>
      new Promise<void>((resolve) => {
        stream.end(() => resolve());
      }),
  };
}

/** Enabled levels = the chosen level and everything more severe. */
function levelsFor(level: string): LogLevel[] {
  const normalized = level === 'info' ? 'log' : level;
  const idx = LEVEL_ORDER.indexOf(normalized as LogLevel);
  const start = idx === -1 ? LEVEL_ORDER.indexOf('log') : idx;
  return LEVEL_ORDER.slice(start);
}
