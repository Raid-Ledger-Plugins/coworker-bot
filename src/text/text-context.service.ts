import { Injectable, Logger } from '@nestjs/common';
import { TextChannel } from 'discord.js';
import { CoworkerConfigService } from '../config/coworker.config.js';

export interface ChannelContext {
  /** Recent human message contents joined for the keyword tree to match. */
  text: string;
  /** Count of human (non-bot) messages within the activity window. */
  recentHumanMessages: number;
  /** Number of distinct humans who spoke within the activity window. */
  recentAuthors: number;
}

/**
 * Text-channel counterpart to the voice {@link AudioRecorderService}: instead
 * of recording and transcribing audio, it reads the channel's recent messages.
 * It returns both the text (for keyword matching) and a measure of how lively
 * the channel is right now, so the caller can refuse to post into dead channels.
 */
@Injectable()
export class TextContextService {
  private readonly logger = new Logger(TextContextService.name);

  constructor(private readonly cfg: CoworkerConfigService) {}

  async readContext(
    channel: TextChannel,
    now: number = Date.now(),
  ): Promise<ChannelContext> {
    const cfg = this.cfg.config;
    const windowStart = now - cfg.textActivityWindowMin * 60_000;
    const fetched = await channel.messages.fetch({
      limit: cfg.textContextMessages,
    });

    const parts: string[] = [];
    const authors = new Set<string>();
    let recentHumanMessages = 0;
    for (const msg of fetched.values()) {
      if (msg.author.bot) continue;
      if (msg.createdTimestamp < windowStart) continue;
      recentHumanMessages++;
      authors.add(msg.author.id);
      const content = msg.content.trim();
      if (content) parts.push(content);
    }

    this.logger.log(
      `#${channel.name}: ${recentHumanMessages} human msg(s) from ` +
        `${authors.size} author(s) in the last ${cfg.textActivityWindowMin}m`,
    );
    return {
      text: parts.join('\n'),
      recentHumanMessages,
      recentAuthors: authors.size,
    };
  }
}
