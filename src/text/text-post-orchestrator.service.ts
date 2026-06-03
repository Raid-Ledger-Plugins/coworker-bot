import { Injectable, Logger } from '@nestjs/common';
import { TextChannel } from 'discord.js';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { StateStoreService } from '../state/state-store.service.js';
import { LineLoaderService } from '../lines/line-loader.service.js';
import { ClipSelectorService } from '../listener/clip-selector.service.js';
import { ChannelContext, TextContextService } from './text-context.service.js';

interface TextPostResult {
  ok: boolean;
  reason?: string;
  posted: boolean;
  category: string | null;
}

const IDLE_FALLBACK = 'idle';

/**
 * Text-channel counterpart to {@link VisitOrchestratorService}: reads recent
 * messages, runs them through the shared keyword tree, and posts a themed line.
 */
@Injectable()
export class TextPostOrchestratorService {
  private readonly logger = new Logger(TextPostOrchestratorService.name);
  private busy = false;

  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly lines: LineLoaderService,
    private readonly selector: ClipSelectorService,
    private readonly context: TextContextService,
    private readonly state: StateStoreService,
  ) {}

  isBusy(): boolean {
    return this.busy;
  }

  async post(channel: TextChannel): Promise<TextPostResult> {
    if (this.busy) {
      return { ok: false, reason: 'busy', posted: false, category: null };
    }
    if (this.lines.count() === 0) {
      return { ok: false, reason: 'no-lines', posted: false, category: null };
    }
    this.busy = true;
    try {
      return await this.runPost(channel);
    } finally {
      this.busy = false;
    }
  }

  private async runPost(channel: TextChannel): Promise<TextPostResult> {
    const started = Date.now();

    let context: ChannelContext;
    try {
      context = await this.context.readContext(channel);
    } catch (err) {
      this.logger.warn(`context read failed: ${String(err)}`);
      return { ok: false, reason: 'error', posted: false, category: null };
    }

    if (!this.hasChatter(context)) {
      this.logger.log(`skipping #${channel.name}: not enough active chatter`);
      return { ok: false, reason: 'no-chatter', posted: false, category: null };
    }

    const category = this.decideCategory(context);
    const line = this.pickLine(category);
    if (!line) {
      return { ok: false, reason: 'no-line', posted: false, category };
    }
    try {
      await channel.send(line.text);
    } catch (err) {
      this.logger.warn(`text post failed: ${String(err)}`);
      return { ok: false, reason: 'error', posted: false, category: line.category };
    }
    this.state.recordTextPost({
      guild_id: channel.guild.id,
      channel_id: channel.id,
      posted_at: started,
      category: line.category,
      line: line.text,
    });
    this.logger.log(
      `text post: ${channel.guild.name}#${channel.name} [${line.category}] "${line.text}"`,
    );
    return { ok: true, posted: true, category: line.category };
  }

  /**
   * The channel counts as "active" only when several humans have spoken
   * recently — a single stale message (or the bot's own last line) is not
   * enough. Thresholds are tunable via TEXT_MIN_MESSAGES / TEXT_MIN_AUTHORS.
   */
  private hasChatter(context: ChannelContext): boolean {
    const cfg = this.cfg.config;
    return (
      context.recentHumanMessages >= cfg.textMinMessages &&
      context.recentAuthors >= cfg.textMinAuthors
    );
  }

  private decideCategory(context: ChannelContext): string | null {
    if (Math.random() < this.cfg.config.randomLineProbability) {
      this.logger.log('random-override: skipping context-based pick');
      return null;
    }
    const matched = this.selector.pickCategory(context.text);
    this.logger.log(`category decision: ${matched ?? 'no-match'}`);
    return matched;
  }

  /**
   * Resolves a category to an actual line, falling back to `idle` and then to a
   * fully random pick — mirroring how the voice path drifts when nothing matches.
   */
  private pickLine(category: string | null): ReturnType<LineLoaderService['pickRandom']> {
    if (category) {
      const matched = this.lines.pickFromCategory(category);
      if (matched) return matched;
    }
    return this.lines.pickFromCategory(IDLE_FALLBACK) ?? this.lines.pickRandom();
  }
}
