import { Injectable } from '@nestjs/common';
import { ChannelType, Guild, VoiceBasedChannel } from 'discord.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { StateStoreService } from '../state/state-store.service.js';

export interface EligibleTarget {
  channel: VoiceBasedChannel;
  humanCount: number;
}

@Injectable()
export class VisitEligibilityService {
  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly state: StateStoreService,
  ) {}

  isWithinQuietHours(now: Date = new Date()): boolean {
    const cfg = this.cfg.config;
    const start = cfg.quietHoursStart;
    const end = cfg.quietHoursEnd;
    if (start === end) return false;
    const hr = now.getHours();
    if (start < end) {
      return hr >= start && hr < end;
    }
    // crosses midnight, e.g. start=22 end=06
    return hr >= start || hr < end;
  }

  isGlobalCooldownActive(now: number = Date.now()): boolean {
    const last = this.state.lastGlobalVisitAt();
    if (last === null) return false;
    const cooldownMs = this.cfg.config.globalCooldownMin * 60_000;
    return now - last < cooldownMs;
  }

  isChannelCooldownActive(channelId: string, now: number = Date.now()): boolean {
    const last = this.state.lastChannelVisitAt(channelId);
    if (last === null) return false;
    const cooldownMs = this.cfg.config.channelCooldownMin * 60_000;
    return now - last < cooldownMs;
  }

  findEligibleTargets(guilds: Iterable<Guild>): EligibleTarget[] {
    const targets: EligibleTarget[] = [];
    for (const guild of guilds) {
      if (!this.state.isGuildEnabled(guild.id)) continue;
      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildVoice) continue;
        const voice = channel as VoiceBasedChannel;
        const target = this.evaluateChannel(voice);
        if (target) targets.push(target);
      }
    }
    return targets;
  }

  private evaluateChannel(channel: VoiceBasedChannel): EligibleTarget | null {
    if (this.state.isChannelOptedOut(channel.guild.id, channel.id)) return null;
    if (this.isChannelCooldownActive(channel.id)) return null;
    const humans = countHumans(channel);
    if (humans < this.cfg.config.minOccupants) return null;
    return { channel, humanCount: humans };
  }
}

function countHumans(channel: VoiceBasedChannel): number {
  let count = 0;
  for (const member of channel.members.values()) {
    if (member.user.bot) continue;
    count++;
  }
  return count;
}
