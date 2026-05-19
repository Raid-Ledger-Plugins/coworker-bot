import { Injectable, Logger } from '@nestjs/common';
import {
  AudioPlayerStatus,
  DiscordGatewayAdapterCreator,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import { DiscordClientService } from '../bot/discord-client.service.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { ClipLoaderService, Clip } from '../clips/clip-loader.service.js';
import { StateStoreService } from '../state/state-store.service.js';
import { VoiceActivityService } from '../voice-activity/voice-activity.service.js';

interface VisitResult {
  ok: boolean;
  reason?: string;
  clipsPlayed: number;
  durationMs: number;
}

const ACTIVITY_SAMPLE_MS = 4_000;
const CONNECTION_READY_TIMEOUT_MS = 15_000;

@Injectable()
export class VisitOrchestratorService {
  private readonly logger = new Logger(VisitOrchestratorService.name);
  private busy = false;

  constructor(
    private readonly bot: DiscordClientService,
    private readonly cfg: CoworkerConfigService,
    private readonly clips: ClipLoaderService,
    private readonly state: StateStoreService,
    private readonly activity: VoiceActivityService,
  ) {}

  isBusy(): boolean {
    return this.busy;
  }

  async visit(channel: VoiceBasedChannel): Promise<VisitResult> {
    if (this.busy) {
      return { ok: false, reason: 'busy', clipsPlayed: 0, durationMs: 0 };
    }
    if (this.clips.count() === 0) {
      return { ok: false, reason: 'no-clips', clipsPlayed: 0, durationMs: 0 };
    }
    this.busy = true;
    const started = Date.now();
    let clipsPlayed = 0;
    let connection: VoiceConnection | null = null;
    try {
      connection = this.openConnection(channel);
      await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        CONNECTION_READY_TIMEOUT_MS,
      );
      await this.awkwardSilence();
      const aborted = await this.maybeAbortForActivity(connection);
      if (aborted) {
        return {
          ok: false,
          reason: 'conversation-active',
          clipsPlayed: 0,
          durationMs: Date.now() - started,
        };
      }
      clipsPlayed = await this.playSequence(connection);
      await this.linger();
      return { ok: true, clipsPlayed, durationMs: Date.now() - started };
    } catch (err) {
      this.logger.warn(`visit failed: ${String(err)}`);
      return {
        ok: false,
        reason: 'error',
        clipsPlayed,
        durationMs: Date.now() - started,
      };
    } finally {
      try {
        connection?.destroy();
      } catch {
        /* ignore */
      }
      const duration = Date.now() - started;
      this.state.recordVisit({
        guild_id: channel.guild.id,
        channel_id: channel.id,
        visited_at: started,
        duration_ms: duration,
        clips_played: clipsPlayed,
      });
      this.busy = false;
      this.logger.log(
        `visit complete: ${channel.guild.name}#${channel.name} clips=${clipsPlayed} duration=${duration}ms`,
      );
    }
  }

  private openConnection(channel: VoiceBasedChannel): VoiceConnection {
    return joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild
        .voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
  }

  private async awkwardSilence(): Promise<void> {
    const base = this.cfg.config.awkwardSilenceMs;
    const jitter = base * 0.5;
    const ms = base + (Math.random() * 2 - 1) * jitter;
    await sleep(Math.max(0, ms));
  }

  private async linger(): Promise<void> {
    await sleep(this.cfg.config.lingerAfterMs);
  }

  private async maybeAbortForActivity(connection: VoiceConnection): Promise<boolean> {
    if (!this.cfg.config.respectActiveConversation) return false;
    const botId = this.bot.client.user?.id;
    if (!botId) return false;
    const sample = await this.activity.sample(connection, botId, ACTIVITY_SAMPLE_MS);
    if (sample.speakers >= 1) {
      this.logger.log(
        `aborting visit: ${sample.speakers} active speakers in ${sample.sampledMs}ms`,
      );
      return true;
    }
    return false;
  }

  private async playSequence(connection: VoiceConnection): Promise<number> {
    const cfg = this.cfg.config;
    const count = pickClipCount(cfg.clipsPerVisitMin, cfg.clipsPerVisitMax);
    const picks = this.clips.pickSequence(count);
    let played = 0;
    for (const clip of picks) {
      const ok = await this.playOne(connection, clip);
      if (ok) played++;
      if (played < picks.length) {
        await sleep(cfg.pauseBetweenClipsMs);
      }
    }
    return played;
  }

  private async playOne(
    connection: VoiceConnection,
    clip: Clip,
  ): Promise<boolean> {
    const player = createAudioPlayer();
    const resource = createAudioResource(clip.filePath, {
      inputType: StreamType.Arbitrary,
    });
    const sub = connection.subscribe(player);
    try {
      player.play(resource);
      await entersState(player, AudioPlayerStatus.Playing, 5_000);
      await new Promise<void>((resolve) => {
        const done = (): void => resolve();
        player.once(AudioPlayerStatus.Idle, done);
        player.once('error', done);
      });
      this.logger.log(`played clip: ${clip.category}/${clip.name}`);
      return true;
    } catch (err) {
      this.logger.warn(`clip failed: ${clip.name} — ${String(err)}`);
      return false;
    } finally {
      sub?.unsubscribe();
      player.stop(true);
    }
  }
}

function pickClipCount(min: number, max: number): number {
  const lo = Math.max(1, Math.min(min, max));
  const hi = Math.max(lo, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
