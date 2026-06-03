import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as http from 'node:http';
import { DiscordClientService } from '../bot/discord-client.service.js';
import { CoworkerConfigService } from '../config/coworker.config.js';

/**
 * Tiny HTTP health endpoint for Fly's machine-level checks (mirrors Stella's
 * sxm_bot/health.py). A worker app has no `[[services]]` block, so Fly's probe
 * needs something to hit: `GET /health` returns 200 only once the Discord
 * gateway is ready, 503 otherwise — so a wedged-but-alive gateway flips the
 * check and Fly restarts the machine.
 *
 * Disabled (no server bound) when `HEALTH_PORT` is 0 / unset, so local dev and
 * the docker-compose deploys don't open a port they don't need.
 */
@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private server: http.Server | null = null;

  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly bot: DiscordClientService,
  ) {}

  onModuleInit(): void {
    const port = this.cfg.config.healthPort;
    if (port <= 0) return;

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        const ready = this.bot.isReady();
        res.writeHead(ready ? 200 : 503, { 'content-type': 'text/plain' });
        res.end(ready ? 'ok' : 'not ready');
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    });

    this.server.on('error', (err) =>
      this.logger.error(`health server error: ${String(err)}`),
    );
    this.server.listen(port, '0.0.0.0', () =>
      this.logger.log(`Health endpoint listening on 0.0.0.0:${port}/health`),
    );
  }

  onModuleDestroy(): void {
    this.server?.close();
    this.server = null;
  }
}
