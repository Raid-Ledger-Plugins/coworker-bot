import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { CoworkerConfigService } from '../config/coworker.config.js';

@Injectable()
export class DiscordClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordClientService.name);
  readonly client: Client;
  private ready = false;

  constructor(private readonly cfg: CoworkerConfigService) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Channel, Partials.GuildMember],
    });
  }

  async onModuleInit(): Promise<void> {
    this.cfg.assertValid();
    this.client.once('ready', (c) => {
      this.ready = true;
      this.logger.log(`Logged in as ${c.user.tag} (${c.user.id})`);
    });
    this.client.on('error', (err) => this.logger.error('client error', err));
    this.client.on('warn', (msg) => this.logger.warn(msg));
    await this.client.login(this.cfg.config.discordBotToken);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.destroy();
    } catch (err) {
      this.logger.warn(`destroy error: ${String(err)}`);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  isGuildAllowed(guildId: string): boolean {
    const allowed = this.cfg.config.allowedGuildIds;
    return allowed.length === 0 || allowed.includes(guildId);
  }
}
