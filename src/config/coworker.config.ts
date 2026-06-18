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
  logLevel: string;
  logDir: string;
  logKeepDays: number;
  healthPort: number;
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
      // Voice visits are meant to be an occasional surprise (a few times a
      // week), not a per-session interruption. Low per-tick odds plus long
      // global/channel cooldowns keep the bot from dropping into the same
      // gaming session repeatedly.
      visitProbability: readNum('VISIT_PROBABILITY', 0.01),
      minOccupants: readNum('MIN_OCCUPANTS', 2),
      globalCooldownMin: readNum('GLOBAL_COOLDOWN_MIN', 360),
      channelCooldownMin: readNum('CHANNEL_COOLDOWN_MIN', 1_440),
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
      // A few hours between text posts — not a week. The old 10080-min (7-day)
      // defaults meant the bot would post once and then go silent for a week.
      textGlobalCooldownMin: readNum('TEXT_GLOBAL_COOLDOWN_MIN', 180),
      textChannelCooldownMin: readNum('TEXT_CHANNEL_COOLDOWN_MIN', 720),
      textActivityWindowMin: readNum('TEXT_ACTIVITY_WINDOW_MIN', 60),
      // Quiet servers rarely see 4 messages from 2 people in an hour, which left
      // the bot permanently gated out of text. A couple of recent human
      // messages is enough of a signal that someone's around to talk to.
      textMinMessages: readNum('TEXT_MIN_MESSAGES', 2),
      textMinAuthors: readNum('TEXT_MIN_AUTHORS', 1),
      textContextMessages: readNum('TEXT_CONTEXT_MESSAGES', 20),
      randomLineProbability: readNum('RANDOM_LINE_PROBABILITY', 0.3),
      whisperBinPath: process.env.WHISPER_BIN_PATH ?? 'whisper-cli',
      whisperModelPath: path.resolve(
        process.env.WHISPER_MODEL_PATH ?? './models/ggml-tiny.en.bin',
      ),
      clipsDir: path.resolve(process.env.CLIPS_DIR ?? './clips'),
      linesDir: path.resolve(process.env.LINES_DIR ?? './lines'),
      dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
      logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
      logDir: process.env.LOG_DIR?.trim()
        ? path.resolve(process.env.LOG_DIR)
        : '',
      logKeepDays: readNum('LOG_KEEP_DAYS', 60),
      healthPort: readNum('HEALTH_PORT', 0),
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
