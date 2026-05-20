import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { CoworkerConfigService } from '../config/coworker.config.js';

const TRANSCRIBE_TIMEOUT_MS = 20_000;

@Injectable()
export class TranscriberService {
  private readonly logger = new Logger(TranscriberService.name);

  async transcribe(wavPath: string): Promise<string> {
    return runWhisper(
      this.cfg.config.whisperBinPath,
      this.cfg.config.whisperModelPath,
      wavPath,
    ).catch((err) => {
      this.logger.warn(`transcription failed: ${String(err)}`);
      return '';
    });
  }

  constructor(private readonly cfg: CoworkerConfigService) {}
}

async function runWhisper(
  binPath: string,
  modelPath: string,
  wavPath: string,
): Promise<string> {
  await assertReadable(modelPath, 'whisper model');
  const args = [
    '-m', modelPath,
    '-f', wavPath,
    '-l', 'en',
    '--no-prints',
    '-otxt',
  ];
  await spawnWithTimeout(binPath, args, TRANSCRIBE_TIMEOUT_MS);
  return readTranscript(`${wavPath}.txt`);
}

async function assertReadable(p: string, label: string): Promise<void> {
  try {
    await fs.promises.access(p, fs.constants.R_OK);
  } catch {
    throw new Error(`${label} not readable at ${p}`);
  }
}

function spawnWithTimeout(
  bin: string,
  args: string[],
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('whisper timed out'));
    }, timeoutMs);
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`whisper exit ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

async function readTranscript(txtPath: string): Promise<string> {
  try {
    const raw = await fs.promises.readFile(txtPath, 'utf8');
    await fs.promises.unlink(txtPath).catch(() => undefined);
    return raw.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}
