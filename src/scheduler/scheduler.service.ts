import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Guild } from 'discord.js';
import { DiscordClientService } from '../bot/discord-client.service.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { VisitEligibilityService } from './visit-eligibility.service.js';
import { VisitOrchestratorService } from '../visit/visit-orchestrator.service.js';
import { TextEligibilityService } from '../text/text-eligibility.service.js';
import { TextPostOrchestratorService } from '../text/text-post-orchestrator.service.js';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly bot: DiscordClientService,
    private readonly eligibility: VisitEligibilityService,
    private readonly visit: VisitOrchestratorService,
    private readonly textEligibility: TextEligibilityService,
    private readonly textPost: TextPostOrchestratorService,
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
    if (this.eligibility.isWithinQuietHours()) return;
    await this.maybeVoiceVisit();
    await this.maybeTextPost();
  }

  private allowedGuilds(): Guild[] {
    return Array.from(this.bot.client.guilds.cache.values()).filter((g) =>
      this.bot.isGuildAllowed(g.id),
    );
  }

  private async maybeVoiceVisit(): Promise<void> {
    if (this.visit.isBusy()) return;
    if (this.eligibility.isGlobalCooldownActive()) return;

    const targets = this.eligibility.findEligibleTargets(this.allowedGuilds());
    if (targets.length === 0) return;

    if (Math.random() >= this.cfg.config.visitProbability) return;

    const pick = targets[Math.floor(Math.random() * targets.length)];
    this.logger.log(
      `attempting visit: ${pick.channel.guild.name}#${pick.channel.name} (humans=${pick.humanCount})`,
    );
    await this.visit.visit(pick.channel);
  }

  private async maybeTextPost(): Promise<void> {
    if (!this.cfg.config.textEnabled) return;
    if (this.textPost.isBusy()) return;
    if (this.textEligibility.isGlobalTextCooldownActive()) return;

    const targets = this.textEligibility.findEligibleTextChannels(
      this.allowedGuilds(),
    );
    if (targets.length === 0) return;

    if (Math.random() >= this.cfg.config.textPostProbability) return;

    const pick = targets[Math.floor(Math.random() * targets.length)];
    this.logger.log(
      `attempting text post: ${pick.channel.guild.name}#${pick.channel.name}`,
    );
    await this.textPost.post(pick.channel);
  }
}
