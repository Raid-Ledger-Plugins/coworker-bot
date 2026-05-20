import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoworkerConfigService } from '../config/coworker.config.js';

export interface Clip {
  /** Absolute path to the audio file. */
  filePath: string;
  /** Lowercase basename used as a short ID. */
  name: string;
  /** Category derived from the parent folder, e.g. 'greeting' / 'mundane' / 'creepy'. */
  category: string;
  /** Approximate weight for the random picker. Higher = more frequent. */
  weight: number;
}

const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.opus', '.wav', '.m4a']);

@Injectable()
export class ClipLoaderService implements OnModuleInit {
  private readonly logger = new Logger(ClipLoaderService.name);
  private clips: Clip[] = [];

  constructor(private readonly cfg: CoworkerConfigService) {}

  onModuleInit(): void {
    this.reload();
  }

  reload(): void {
    const dir = this.cfg.config.clipsDir;
    if (!fs.existsSync(dir)) {
      this.logger.warn(`Clips dir does not exist: ${dir}`);
      this.clips = [];
      return;
    }
    this.clips = this.scanDir(dir, 'uncategorized');
    this.logger.log(
      `Loaded ${this.clips.length} clips from ${dir} ` +
        `(categories: ${this.categoryBreakdown()})`,
    );
  }

  private scanDir(dir: string, category: string): Clip[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const found: Clip[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...this.scanDir(full, entry.name.toLowerCase()));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTS.has(ext)) continue;
      found.push({
        filePath: full,
        name: entry.name.toLowerCase(),
        category,
        weight: 1,
      });
    }
    return found;
  }

  private categoryBreakdown(): string {
    const counts = new Map<string, number>();
    for (const c of this.clips) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([cat, n]) => `${cat}:${n}`)
      .join(', ');
  }

  count(): number {
    return this.clips.length;
  }

  pickRandom(): Clip | null {
    if (this.clips.length === 0) return null;
    const idx = Math.floor(Math.random() * this.clips.length);
    return this.clips[idx];
  }

  pickRandomFromCategory(category: string): Clip | null {
    const filtered = this.clips.filter((c) => c.category === category);
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Picks up to `count` distinct clips. When `preferredCategory` is set, the
   * first pick comes from that category (if any clips exist there) and the
   * remainder are random across all categories — so the bot opens with a
   * context-matched line and drifts after.
   */
  pickSequence(count: number, preferredCategory?: string): Clip[] {
    if (this.clips.length === 0) return [];
    const picks: Clip[] = [];
    const seen = new Set<string>();
    if (preferredCategory) {
      const first = this.pickRandomFromCategory(preferredCategory);
      if (first) {
        picks.push(first);
        seen.add(first.filePath);
      }
    }
    let safety = count * 4;
    while (picks.length < count && safety-- > 0) {
      const next = this.pickRandom();
      if (!next) break;
      if (seen.has(next.filePath)) continue;
      seen.add(next.filePath);
      picks.push(next);
    }
    return picks;
  }
}
