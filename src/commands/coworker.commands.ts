import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ChannelType,
  ChatInputCommandInteraction,
  Interaction,
  MessageFlags,
  PermissionFlagsBits,
  VoiceBasedChannel,
} from 'discord.js';
import { DiscordClientService } from '../bot/discord-client.service.js';
import { StateStoreService } from '../state/state-store.service.js';
import { VisitOrchestratorService } from '../visit/visit-orchestrator.service.js';
import { ClipLoaderService } from '../clips/clip-loader.service.js';

@Injectable()
export class CoworkerCommandsService implements OnModuleInit {
  private readonly logger = new Logger(CoworkerCommandsService.name);

  constructor(
    private readonly bot: DiscordClientService,
    private readonly state: StateStoreService,
    private readonly visit: VisitOrchestratorService,
    private readonly clips: ClipLoaderService,
  ) {}

  onModuleInit(): void {
    this.bot.client.on('interactionCreate', (interaction) => {
      void this.handle(interaction).catch((err) =>
        this.logger.error(`interaction error: ${String(err)}`),
      );
    });
  }

  private async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'coworker') return;
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'guild-only',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const sub = interaction.options.getSubcommand();
    switch (sub) {
      case 'enable':
        return this.cmdEnable(interaction, true);
      case 'disable':
        return this.cmdEnable(interaction, false);
      case 'visit':
        return this.cmdVisit(interaction);
      case 'stats':
        return this.cmdStats(interaction);
      case 'mute-channel':
        return this.cmdMuteChannel(interaction, true);
      case 'unmute-channel':
        return this.cmdMuteChannel(interaction, false);
      case 'reload-clips':
        return this.cmdReloadClips(interaction);
      default:
        await interaction.reply({
          content: `unknown subcommand: ${sub}`,
          flags: MessageFlags.Ephemeral,
        });
    }
  }

  private async cmdEnable(
    interaction: ChatInputCommandInteraction,
    enable: boolean,
  ): Promise<void> {
    if (!this.requireAdmin(interaction)) return;
    this.state.setGuildEnabled(interaction.guildId!, enable);
    await interaction.reply({
      content: enable
        ? 'Coworker is now active in this server.'
        : 'Coworker is now disabled in this server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  private async cmdVisit(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!this.requireAdmin(interaction)) return;
    const channel = interaction.options.getChannel('channel', true);
    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: 'channel must be a voice channel',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      content: `sending coworker to <#${channel.id}>...`,
      flags: MessageFlags.Ephemeral,
    });
    const guild = interaction.guild!;
    const voice = guild.channels.cache.get(channel.id) as VoiceBasedChannel | undefined;
    if (!voice) return;
    const result = await this.visit.visit(voice);
    await interaction.followUp({
      content: result.ok
        ? `visit complete (clips=${result.clipsPlayed})`
        : `visit aborted: ${result.reason}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async cmdStats(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const s = this.state.stats();
    const last = s.lastVisitAt ? new Date(s.lastVisitAt).toISOString() : 'never';
    await interaction.reply({
      content:
        `total visits: ${s.totalVisits}\n` +
        `last 24h: ${s.visitsLast24h}\n` +
        `last visit: ${last}\n` +
        `clips loaded: ${this.clips.count()}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async cmdMuteChannel(
    interaction: ChatInputCommandInteraction,
    mute: boolean,
  ): Promise<void> {
    if (!this.requireAdmin(interaction)) return;
    const channel = interaction.options.getChannel('channel', true);
    this.state.setChannelOptOut(interaction.guildId!, channel.id, mute);
    await interaction.reply({
      content: mute
        ? `coworker will skip <#${channel.id}>`
        : `coworker may visit <#${channel.id}> again`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async cmdReloadClips(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!this.requireAdmin(interaction)) return;
    this.clips.reload();
    await interaction.reply({
      content: `reloaded ${this.clips.count()} clips`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private requireAdmin(interaction: ChatInputCommandInteraction): boolean {
    const perms = interaction.memberPermissions;
    if (perms?.has(PermissionFlagsBits.ManageGuild)) return true;
    void interaction.reply({
      content: 'requires Manage Server permission',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
}
