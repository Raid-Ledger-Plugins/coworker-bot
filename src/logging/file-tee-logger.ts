import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { inspect } from 'node:util';
import { RotatingFileStream } from 'rotating-file-stream';

/**
 * Nest framework contexts whose INFO/DEBUG chatter we keep out of the
 * persistent file. Their warnings/errors still pass (see {@link accepts}).
 */
const FRAMEWORK_CONTEXTS = new Set([
  'InstanceLoader',
  'NestFactory',
  'NestApplication',
  'NestApplicationContext',
  'RoutesResolver',
  'RouterExplorer',
  'WebSocketsController',
]);

/**
 * A Nest logger that keeps the familiar stdout output (via {@link ConsoleLogger})
 * and additionally tees a filtered copy of each line to a rotating file.
 *
 * The filter mirrors Stella's `_BotSignalFilter`: the stdout stream is the
 * firehose, while the file keeps only the lines an operator opens it to find —
 * any warning/error, plus the bot's own info/debug lines (framework bootstrap
 * chatter is dropped). The file survives past Fly's short stdout buffer.
 */
export class FileTeeLogger extends ConsoleLogger {
  constructor(
    private readonly sink: RotatingFileStream,
    logLevels: LogLevel[],
  ) {
    super('Coworker', { logLevels });
  }

  log(message: unknown, ...rest: unknown[]): void {
    super.log(message as string, ...(rest as string[]));
    this.tee('log', message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    super.warn(message as string, ...(rest as string[]));
    this.tee('warn', message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    super.error(message as string, ...(rest as string[]));
    this.tee('error', message, rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    super.debug(message as string, ...(rest as string[]));
    this.tee('debug', message, rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    super.verbose(message as string, ...(rest as string[]));
    this.tee('verbose', message, rest);
  }

  private tee(level: LogLevel, message: unknown, rest: unknown[]): void {
    const context = this.contextOf(rest);
    if (!this.accepts(level, context)) return;
    const ts = new Date().toISOString();
    const body = this.render(message, rest);
    this.sink.write(`${ts} ${level.toUpperCase().padEnd(7)} [${context ?? '-'}] ${body}\n`);
  }

  /**
   * Accept any warning/error always; accept info/debug/verbose only when the
   * configured level enables it AND the line is from one of the bot's own
   * loggers (not a Nest framework context).
   */
  private accepts(level: LogLevel, context: string | undefined): boolean {
    if (level === 'warn' || level === 'error' || level === 'fatal') return true;
    if (!this.isLevelEnabled(level)) return false;
    return context === undefined || !FRAMEWORK_CONTEXTS.has(context);
  }

  /** Nest passes the logger's context as the trailing string param. */
  private contextOf(rest: unknown[]): string | undefined {
    const last = rest[rest.length - 1];
    return typeof last === 'string' ? last : undefined;
  }

  private render(message: unknown, rest: unknown[]): string {
    const parts = [asText(message)];
    // For error(), rest is [stack, context]; keep the stack, drop the context.
    for (const extra of rest.slice(0, Math.max(0, rest.length - 1))) {
      parts.push(asText(extra));
    }
    return parts.join(' ');
  }
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? value.message;
  return inspect(value, { depth: 3, breakLength: Infinity });
}
