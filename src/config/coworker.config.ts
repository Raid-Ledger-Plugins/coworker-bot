import { Injectable } from '@nestjs/common';
import * as path from 'node:path';

export interface CoworkerConfig {
  discordBotToken: string;
  discordClientId: string;
  allowedGuildIds: string[];
  tickIntervalMs: number;
  visitProbability: number;
  minOccupants: number;
  globalCooldownMin: number;
  channelCooldownMin: number;
  awkwardSilenceMs: number;
  clipsPerVisitMin: number;
  clipsPerVisitMax: number;
  pauseBetweenClipsMs: number;
  lingerAfterMs: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  respectActiveConversation: boolean;
  clipsDir: string;
  dataDir: string;
}

function readNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function readCsv(key: string): string[] {
  const raw = process.env[key];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class CoworkerConfigService {
  readonly config: CoworkerConfig;

  constructor() {
    this.config = {
      discordBotToken: process.env.DISCORD_BOT_TOKEN ?? '',
      discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
      allowedGuildIds: readCsv('ALLOWED_GUILD_IDS'),
      tickIntervalMs: readNum('TICK_INTERVAL_MS', 120_000),
      visitProbability: readNum('VISIT_PROBABILITY', 0.03),
      minOccupants: readNum('MIN_OCCUPANTS', 2),
      globalCooldownMin: readNum('GLOBAL_COOLDOWN_MIN', 90),
      channelCooldownMin: readNum('CHANNEL_COOLDOWN_MIN', 360),
      awkwardSilenceMs: readNum('AWKWARD_SILENCE_MS', 12_000),
      clipsPerVisitMin: readNum('CLIPS_PER_VISIT_MIN', 1),
      clipsPerVisitMax: readNum('CLIPS_PER_VISIT_MAX', 3),
      pauseBetweenClipsMs: readNum('PAUSE_BETWEEN_CLIPS_MS', 4_000),
      lingerAfterMs: readNum('LINGER_AFTER_MS', 15_000),
      quietHoursStart: readNum('QUIET_HOURS_START', 3),
      quietHoursEnd: readNum('QUIET_HOURS_END', 10),
      respectActiveConversation: readBool('RESPECT_ACTIVE_CONVERSATION', true),
      clipsDir: path.resolve(process.env.CLIPS_DIR ?? './clips'),
      dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
    };
  }

  assertValid(): void {
    if (!this.config.discordBotToken) {
      throw new Error('DISCORD_BOT_TOKEN is required');
    }
    if (!this.config.discordClientId) {
      throw new Error('DISCORD_CLIENT_ID is required');
    }
  }
}
