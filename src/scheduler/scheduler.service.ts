import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscordClientService } from '../bot/discord-client.service.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { VisitEligibilityService } from './visit-eligibility.service.js';
import { VisitOrchestratorService } from '../visit/visit-orchestrator.service.js';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly bot: DiscordClientService,
    private readonly eligibility: VisitEligibilityService,
    private readonly visit: VisitOrchestratorService,
  ) {}

  onModuleInit(): void {
    const interval = this.cfg.config.tickIntervalMs;
    this.logger.log(`Scheduler starting (tick every ${interval}ms)`);
    this.timer = setInterval(() => {
      void this.tick().catch((err) =>
        this.logger.error(`tick error: ${String(err)}`),
      );
    }, interval);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (!this.bot.isReady()) return;
    if (this.visit.isBusy()) return;
    if (this.eligibility.isWithinQuietHours()) return;
    if (this.eligibility.isGlobalCooldownActive()) return;

    const guilds = Array.from(this.bot.client.guilds.cache.values()).filter((g) =>
      this.bot.isGuildAllowed(g.id),
    );
    const targets = this.eligibility.findEligibleTargets(guilds);
    if (targets.length === 0) return;

    const probability = this.cfg.config.visitProbability;
    if (Math.random() >= probability) return;

    const pick = targets[Math.floor(Math.random() * targets.length)];
    this.logger.log(
      `attempting visit: ${pick.channel.guild.name}#${pick.channel.name} (humans=${pick.humanCount})`,
    );
    await this.visit.visit(pick.channel);
  }
}
