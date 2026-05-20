import { Injectable, Logger } from '@nestjs/common';
import { VoiceConnection } from '@discordjs/voice';
import * as fs from 'node:fs';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { AudioRecorderService } from './audio-recorder.service.js';
import { ClipSelectorService } from './clip-selector.service.js';
import { TranscriberService } from './transcriber.service.js';

export interface ListenResult {
  category: string | null;
  transcript: string;
  reason: 'matched' | 'no-match' | 'silent' | 'disabled' | 'random-override';
}

const IDLE_FALLBACK = 'idle';

@Injectable()
export class ListenerService {
  private readonly logger = new Logger(ListenerService.name);

  constructor(
    private readonly cfg: CoworkerConfigService,
    private readonly recorder: AudioRecorderService,
    private readonly transcriber: TranscriberService,
    private readonly selector: ClipSelectorService,
  ) {}

  async listenAndPick(
    connection: VoiceConnection,
    botUserId: string,
  ): Promise<ListenResult> {
    if (!this.cfg.config.listenEnabled) {
      return { category: null, transcript: '', reason: 'disabled' };
    }
    if (Math.random() < this.cfg.config.randomClipProbability) {
      this.logger.log('random-override: skipping transcript-based pick');
      return { category: null, transcript: '', reason: 'random-override' };
    }
    return this.runFlow(connection, botUserId);
  }

  private async runFlow(
    connection: VoiceConnection,
    botUserId: string,
  ): Promise<ListenResult> {
    const wavPath = await this.recorder.record(
      connection,
      this.cfg.config.listenDurationMs,
      botUserId,
    );
    if (!wavPath) {
      return { category: IDLE_FALLBACK, transcript: '', reason: 'silent' };
    }
    try {
      const transcript = await this.transcriber.transcribe(wavPath);
      this.logger.log(`transcript: "${transcript.slice(0, 120)}"`);
      const matched = this.selector.pickCategory(transcript);
      return {
        category: matched ?? null,
        transcript,
        reason: matched ? 'matched' : 'no-match',
      };
    } finally {
      fs.promises.unlink(wavPath).catch(() => undefined);
    }
  }
}
