import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoworkerConfigService } from '../config/coworker.config.js';

export interface Line {
  /** The phrase the bot will post. */
  text: string;
  /** Category derived from the parent folder, e.g. 'ty' / 'bye' / 'idle'. */
  category: string;
}

const TEXT_EXTS = new Set(['.txt']);

/**
 * Text-line counterpart to {@link ClipLoaderService}. Scans `linesDir`
 * recursively; every non-empty, non-comment line inside a `.txt` file becomes
 * a candidate phrase tagged with its parent folder as the category.
 */
@Injectable()
export class LineLoaderService implements OnModuleInit {
  private readonly logger = new Logger(LineLoaderService.name);
  private lines: Line[] = [];

  constructor(private readonly cfg: CoworkerConfigService) {}

  onModuleInit(): void {
    this.reload();
  }

  reload(): void {
    const dir = this.cfg.config.linesDir;
    if (!fs.existsSync(dir)) {
      this.logger.warn(`Lines dir does not exist: ${dir}`);
      this.lines = [];
      return;
    }
    this.lines = this.scanDir(dir, 'uncategorized');
    this.logger.log(
      `Loaded ${this.lines.length} lines from ${dir} ` +
        `(categories: ${this.categoryBreakdown()})`,
    );
  }

  private scanDir(dir: string, category: string): Line[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const found: Line[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...this.scanDir(full, entry.name.toLowerCase()));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
        const text = raw.trim();
        if (!text || text.startsWith('#')) continue;
        found.push({ text, category });
      }
    }
    return found;
  }

  private categoryBreakdown(): string {
    const counts = new Map<string, number>();
    for (const l of this.lines) {
      counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([cat, n]) => `${cat}:${n}`)
      .join(', ');
  }

  count(): number {
    return this.lines.length;
  }

  pickRandom(): Line | null {
    if (this.lines.length === 0) return null;
    return this.lines[Math.floor(Math.random() * this.lines.length)];
  }

  pickFromCategory(category: string): Line | null {
    const filtered = this.lines.filter((l) => l.category === category);
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
}
