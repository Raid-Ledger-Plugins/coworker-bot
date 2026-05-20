import { Injectable, Logger } from '@nestjs/common';
import { EndBehaviorType, VoiceConnection } from '@discordjs/voice';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import prism from 'prism-media';

/**
 * Records mixed audio from a Discord voice channel for a fixed window, then
 * downsamples to 16kHz mono WAV (what whisper.cpp expects). Returns the
 * absolute path to the WAV file, or null if no audio was captured.
 */
@Injectable()
export class AudioRecorderService {
  private readonly logger = new Logger(AudioRecorderService.name);

  async record(
    connection: VoiceConnection,
    durationMs: number,
    botUserId: string,
  ): Promise<string | null> {
    const session = startSession(durationMs);
    const receiver = connection.receiver;

    const onStart = (userId: string): void => {
      if (userId === botUserId) return;
      if (session.userFiles.has(userId)) return;
      this.attachUserStream(receiver, userId, session);
    };
    receiver.speaking.on('start', onStart);

    await new Promise((resolve) => setTimeout(resolve, durationMs));
    receiver.speaking.off('start', onStart);
    await finalizeSession(session);

    if (session.userFiles.size === 0) {
      this.logger.log('listener captured no audio (silent channel)');
      cleanup(session);
      return null;
    }

    const wavPath = await mixToWav(session);
    cleanup(session);
    this.logger.log(
      `listener captured ${session.userFiles.size} speakers -> ${wavPath}`,
    );
    return wavPath;
  }

  private attachUserStream(
    receiver: VoiceConnection['receiver'],
    userId: string,
    session: Session,
  ): void {
    const pcmPath = path.join(
      session.tmpDir,
      `user_${userId}_${Date.now()}.pcm`,
    );
    const out = fs.createWriteStream(pcmPath);
    const opus = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });
    const decoder = new prism.opus.Decoder({
      rate: 48_000,
      channels: 1,
      frameSize: 960,
    });
    opus.pipe(decoder).pipe(out);
    opus.on('error', () => {
      /* ignore */
    });
    session.userFiles.set(userId, { pcmPath, opus, decoder, out });
  }
}

interface UserStream {
  pcmPath: string;
  opus: NodeJS.ReadableStream & { destroy?: () => void };
  decoder: NodeJS.ReadWriteStream & { destroy?: () => void };
  out: fs.WriteStream;
}

interface Session {
  tmpDir: string;
  userFiles: Map<string, UserStream>;
  wavPath: string;
}

function startSession(_durationMs: number): Session {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coworker-listen-'));
  return {
    tmpDir,
    userFiles: new Map(),
    wavPath: path.join(tmpDir, 'mixed.wav'),
  };
}

async function finalizeSession(session: Session): Promise<void> {
  for (const stream of session.userFiles.values()) {
    stream.opus.destroy?.();
    stream.decoder.destroy?.();
    await new Promise<void>((resolve) => stream.out.end(resolve));
  }
}

async function mixToWav(session: Session): Promise<string> {
  const inputs = Array.from(session.userFiles.values()).filter((s) =>
    isNonEmpty(s.pcmPath),
  );
  if (inputs.length === 0) throw new Error('no non-empty input streams');

  const args: string[] = ['-y', '-loglevel', 'error'];
  for (const inp of inputs) {
    args.push('-f', 's16le', '-ar', '48000', '-ac', '1', '-i', inp.pcmPath);
  }
  if (inputs.length > 1) {
    args.push(
      '-filter_complex',
      `amix=inputs=${inputs.length}:duration=longest:dropout_transition=0`,
    );
  }
  args.push('-ar', '16000', '-ac', '1', session.wavPath);

  await spawnFfmpeg(args);
  return session.wavPath;
}

function isNonEmpty(p: string): boolean {
  try {
    return fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

function spawnFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr}`)),
    );
  });
}

function cleanup(session: Session): void {
  try {
    fs.rmSync(session.tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
