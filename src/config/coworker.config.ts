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
  clipsPerVisitMin: number;
  clipsPerVisitMax: number;
  pauseBetweenClipsMs: number;
  lingerAfterMs: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  listenEnabled: boolean;
  listenDurationMs: number;
  randomClipProbability: number;
  textEnabled: boolean;
  textPostProbability: number;
  textGlobalCooldownMin: number;
  textChannelCooldownMin: number;
  textActivityWindowMin: number;
  textMinMessages: number;
  textMinAuthors: number;
  textContextMessages: number;
  randomLineProbability: number;
  whisperBinPath: string;
  whisperModelPath: string;
  clipsDir: string;
  linesDir: string;
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
      clipsPerVisitMin: readNum('CLIPS_PER_VISIT_MIN', 1),
      clipsPerVisitMax: readNum('CLIPS_PER_VISIT_MAX', 3),
      pauseBetweenClipsMs: readNum('PAUSE_BETWEEN_CLIPS_MS', 4_000),
      lingerAfterMs: readNum('LINGER_AFTER_MS', 15_000),
      quietHoursStart: readNum('QUIET_HOURS_START', 3),
      quietHoursEnd: readNum('QUIET_HOURS_END', 10),
      listenEnabled: readBool('LISTEN_ENABLED', true),
      listenDurationMs: readNum('LISTEN_DURATION_MS', 7_000),
      randomClipProbability: readNum('RANDOM_CLIP_PROBABILITY', 0.3),
      textEnabled: readBool('TEXT_ENABLED', true),
      textPostProbability: readNum('TEXT_POST_PROBABILITY', 0.05),
      textGlobalCooldownMin: readNum('TEXT_GLOBAL_COOLDOWN_MIN', 10_080),
      textChannelCooldownMin: readNum('TEXT_CHANNEL_COOLDOWN_MIN', 10_080),
      textActivityWindowMin: readNum('TEXT_ACTIVITY_WINDOW_MIN', 60),
      textMinMessages: readNum('TEXT_MIN_MESSAGES', 4),
      textMinAuthors: readNum('TEXT_MIN_AUTHORS', 2),
      textContextMessages: readNum('TEXT_CONTEXT_MESSAGES', 20),
      randomLineProbability: readNum('RANDOM_LINE_PROBABILITY', 0.3),
      whisperBinPath: process.env.WHISPER_BIN_PATH ?? 'whisper-cli',
      whisperModelPath: path.resolve(
        process.env.WHISPER_MODEL_PATH ?? './models/ggml-tiny.en.bin',
      ),
      clipsDir: path.resolve(process.env.CLIPS_DIR ?? './clips'),
      linesDir: path.resolve(process.env.LINES_DIR ?? './lines'),
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
