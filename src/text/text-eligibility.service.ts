import { Injectable } from '@nestjs/common';
import {
  ChannelType,
  Guild,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { StateStoreService } from '../state/state-store.service.js';

export interface EligibleTextTarget {
  channel: TextChannel;
}

/** Discord's epoch (2015-01-01T00:00:00Z) used to decode snowflake timestamps. */
const DISCORD_EPOCH_MS = 1420070400000n;

@Injectable()
export class TextEligibilityService {
  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly state: StateStoreService,
  ) {}

  isGlobalTextCooldownActive(now: number = Date.now()): boolean {
    const last = this.state.lastGlobalTextPostAt();
    if (last === null) return false;
    const cooldownMs = this.cfg.config.textGlobalCooldownMin * 60_000;
    return now - last < cooldownMs;
  }

  isChannelTextCooldownActive(
    channelId: string,
    now: number = Date.now(),
  ): boolean {
    const last = this.state.lastChannelTextPostAt(channelId);
    if (last === null) return false;
    const cooldownMs = this.cfg.config.textChannelCooldownMin * 60_000;
    return now - last < cooldownMs;
  }

  findEligibleTextChannels(guilds: Iterable<Guild>): EligibleTextTarget[] {
    const targets: EligibleTextTarget[] = [];
    for (const guild of guilds) {
      if (!this.state.isGuildEnabled(guild.id)) continue;
      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildText) continue;
        const text = channel as TextChannel;
        if (this.evaluateChannel(text)) targets.push({ channel: text });
      }
    }
    return targets;
  }

  private evaluateChannel(channel: TextChannel): boolean {
    if (this.state.isChannelOptedOut(channel.guild.id, channel.id)) return false;
    if (this.isChannelTextCooldownActive(channel.id)) return false;
    if (!this.canSpeak(channel)) return false;
    if (!this.isRecentlyActive(channel)) return false;
    return true;
  }

  private canSpeak(channel: TextChannel): boolean {
    const me = channel.guild.members.me;
    if (!me) return false;
    const perms = channel.permissionsFor(me);
    return (
      perms?.has(PermissionFlagsBits.ViewChannel) === true &&
      perms?.has(PermissionFlagsBits.SendMessages) === true
    );
  }

  private isRecentlyActive(
    channel: TextChannel,
    now: number = Date.now(),
  ): boolean {
    const lastId = channel.lastMessageId;
    if (!lastId) return false;
    const windowMs = this.cfg.config.textActivityWindowMin * 60_000;
    return now - snowflakeTimestamp(lastId) < windowMs;
  }
}

/** Decodes the creation time embedded in a Discord snowflake ID. */
function snowflakeTimestamp(id: string): number {
  return Number((BigInt(id) >> 22n) + DISCORD_EPOCH_MS);
}
