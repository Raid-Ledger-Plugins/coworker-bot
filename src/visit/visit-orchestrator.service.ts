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
import { ListenerService } from '../listener/listener.service.js';
import { StateStoreService } from '../state/state-store.service.js';

interface VisitResult {
  ok: boolean;
  reason?: string;
  clipsPlayed: number;
  durationMs: number;
}

/** Minimal shape of @discordjs/voice's internal Networking event emitter. */
interface NetworkingState {
  code?: number;
}
interface NetworkingLike {
  on(
    event: 'stateChange',
    listener: (oldState: NetworkingState, newState: NetworkingState) => void,
  ): unknown;
  on(event: 'error', listener: (err: unknown) => void): unknown;
  on(event: 'close', listener: (code: number) => void): unknown;
}

/** NetworkingStatusCode order in @discordjs/voice (not publicly exported). */
const NETWORKING_CODES = [
  'OpeningWs',
  'Identifying',
  'UdpHandshaking',
  'SelectingProtocol',
  'Ready',
  'Resuming',
  'Closed',
];

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
    private readonly listener: ListenerService,
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
    const result = await this.runVisit(channel, started);
    this.recordOutcome(channel, started, result.clipsPlayed);
    this.busy = false;
    return result;
  }

  private async runVisit(
    channel: VoiceBasedChannel,
    started: number,
  ): Promise<VisitResult> {
    let connection: VoiceConnection | null = null;
    let clipsPlayed = 0;
    try {
      connection = this.openConnection(channel);
      this.attachVoiceDebug(connection, channel);
      await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        CONNECTION_READY_TIMEOUT_MS,
      );
      const category = await this.decideCategory(connection);
      clipsPlayed = await this.playSequence(connection, category);
      await sleep(this.cfg.config.lingerAfterMs);
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
    }
  }

  /**
   * Logs the voice connection's state machine so we can see exactly where a
   * stalled visit gets stuck. The connection goes Signalling -> Connecting ->
   * Ready; the nested networking goes ... -> UdpHandshaking -> SelectingProtocol
   * -> Ready. A stall at networking `UdpHandshaking` points at UDP / IP
   * discovery (the usual culprit when voice fails in a container).
   */
  private attachVoiceDebug(
    connection: VoiceConnection,
    channel: VoiceBasedChannel,
  ): void {
    const where = `${channel.guild.name}#${channel.name}`;
    let hookedNetworking: unknown = null;

    connection.on('stateChange', (oldState, newState) => {
      this.logger.log(
        `voice ${where}: connection ${oldState.status} -> ${newState.status}`,
      );
      const net = (newState as { networking?: NetworkingLike }).networking;
      if (net && net !== hookedNetworking) {
        hookedNetworking = net;
        net.on('stateChange', (o, n) =>
          this.logger.log(
            `voice ${where}: networking ${netCode(o)} -> ${netCode(n)}`,
          ),
        );
        net.on('error', (err) =>
          this.logger.warn(`voice ${where}: networking error: ${String(err)}`),
        );
        net.on('close', (code) =>
          this.logger.warn(`voice ${where}: voice ws closed with code ${code}`),
        );
      }
    });

    connection.on('error', (err) =>
      this.logger.warn(`voice ${where}: connection error: ${String(err)}`),
    );
  }

  private recordOutcome(
    channel: VoiceBasedChannel,
    started: number,
    clipsPlayed: number,
  ): void {
    const duration = Date.now() - started;
    this.state.recordVisit({
      guild_id: channel.guild.id,
      channel_id: channel.id,
      visited_at: started,
      duration_ms: duration,
      clips_played: clipsPlayed,
    });
    this.logger.log(
      `visit complete: ${channel.guild.name}#${channel.name} clips=${clipsPlayed} duration=${duration}ms`,
    );
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

  private async decideCategory(
    connection: VoiceConnection,
  ): Promise<string | undefined> {
    const botId = this.bot.client.user?.id;
    if (!botId) return undefined;
    const result = await this.listener.listenAndPick(connection, botId);
    this.logger.log(
      `category decision: ${result.reason} ${result.category ? '-> ' + result.category : ''}`,
    );
    return result.category ?? undefined;
  }

  private async playSequence(
    connection: VoiceConnection,
    category: string | undefined,
  ): Promise<number> {
    const cfg = this.cfg.config;
    const count = pickClipCount(cfg.clipsPerVisitMin, cfg.clipsPerVisitMax);
    const picks = this.clips.pickSequence(count, category);
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

function netCode(state: NetworkingState): string {
  if (state.code === undefined) return 'unknown';
  return NETWORKING_CODES[state.code] ?? `code${state.code}`;
}
