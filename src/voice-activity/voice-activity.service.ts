import { Injectable, Logger } from '@nestjs/common';
import { EndBehaviorType, VoiceConnection } from '@discordjs/voice';

interface ActivitySample {
  speakers: number;
  sampledMs: number;
}

/**
 * Listens to a voice channel for a short window and reports whether humans
 * appear to be talking. Used to abort visits if a real conversation is in
 * progress (so the bot feels ghostly, not interrupt-y).
 */
@Injectable()
export class VoiceActivityService {
  private readonly logger = new Logger(VoiceActivityService.name);

  async sample(
    connection: VoiceConnection,
    botUserId: string,
    windowMs: number,
  ): Promise<ActivitySample> {
    const receiver = connection.receiver;
    const speaking = new Set<string>();
    const started = Date.now();

    const onStart = (userId: string): void => {
      if (userId === botUserId) return;
      speaking.add(userId);
      // Subscribe so the speaking event keeps firing; we discard the audio.
      const stream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual },
      });
      stream.on('error', () => {
        /* ignore — best-effort sample */
      });
    };

    receiver.speaking.on('start', onStart);
    await new Promise((resolve) => setTimeout(resolve, windowMs));
    receiver.speaking.off('start', onStart);

    const sampledMs = Date.now() - started;
    this.logger.debug?.(
      `voice-activity sample: ${speaking.size} speakers in ${sampledMs}ms`,
    );
    return { speakers: speaking.size, sampledMs };
  }
}
