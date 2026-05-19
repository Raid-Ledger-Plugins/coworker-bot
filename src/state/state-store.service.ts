import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoworkerConfigService } from '../config/coworker.config.js';

interface VisitRow {
  guild_id: string;
  channel_id: string;
  visited_at: number;
  duration_ms: number;
  clips_played: number;
}

@Injectable()
export class StateStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StateStoreService.name);
  private db!: Database.Database;

  constructor(private readonly cfg: CoworkerConfigService) {}

  onModuleInit(): void {
    fs.mkdirSync(this.cfg.config.dataDir, { recursive: true });
    const dbPath = path.join(this.cfg.config.dataDir, 'coworker.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
    this.logger.log(`State store ready at ${dbPath}`);
  }

  onModuleDestroy(): void {
    this.db?.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        visited_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        clips_played INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_visits_channel ON visits(channel_id, visited_at DESC);
      CREATE INDEX IF NOT EXISTS idx_visits_global ON visits(visited_at DESC);

      CREATE TABLE IF NOT EXISTS channel_opt_outs (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        opted_out_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      );

      CREATE TABLE IF NOT EXISTS guild_enabled (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        enabled_at INTEGER NOT NULL
      );
    `);
  }

  recordVisit(row: VisitRow): void {
    this.db
      .prepare(
        `INSERT INTO visits (guild_id, channel_id, visited_at, duration_ms, clips_played)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(row.guild_id, row.channel_id, row.visited_at, row.duration_ms, row.clips_played);
  }

  lastGlobalVisitAt(): number | null {
    const row = this.db
      .prepare(`SELECT visited_at FROM visits ORDER BY visited_at DESC LIMIT 1`)
      .get() as { visited_at: number } | undefined;
    return row?.visited_at ?? null;
  }

  lastChannelVisitAt(channelId: string): number | null {
    const row = this.db
      .prepare(
        `SELECT visited_at FROM visits WHERE channel_id = ? ORDER BY visited_at DESC LIMIT 1`,
      )
      .get(channelId) as { visited_at: number } | undefined;
    return row?.visited_at ?? null;
  }

  isChannelOptedOut(guildId: string, channelId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM channel_opt_outs WHERE guild_id = ? AND channel_id = ?`,
      )
      .get(guildId, channelId);
    return !!row;
  }

  setChannelOptOut(guildId: string, channelId: string, optedOut: boolean): void {
    if (optedOut) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO channel_opt_outs (guild_id, channel_id, opted_out_at)
           VALUES (?, ?, ?)`,
        )
        .run(guildId, channelId, Date.now());
    } else {
      this.db
        .prepare(`DELETE FROM channel_opt_outs WHERE guild_id = ? AND channel_id = ?`)
        .run(guildId, channelId);
    }
  }

  isGuildEnabled(guildId: string): boolean {
    const row = this.db
      .prepare(`SELECT enabled FROM guild_enabled WHERE guild_id = ?`)
      .get(guildId) as { enabled: number } | undefined;
    return row?.enabled === 1;
  }

  setGuildEnabled(guildId: string, enabled: boolean): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO guild_enabled (guild_id, enabled, enabled_at)
         VALUES (?, ?, ?)`,
      )
      .run(guildId, enabled ? 1 : 0, Date.now());
  }

  stats(): {
    totalVisits: number;
    visitsLast24h: number;
    lastVisitAt: number | null;
  } {
    const total = this.db.prepare(`SELECT COUNT(*) AS n FROM visits`).get() as {
      n: number;
    };
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const day = this.db
      .prepare(`SELECT COUNT(*) AS n FROM visits WHERE visited_at >= ?`)
      .get(since) as { n: number };
    return {
      totalVisits: total.n,
      visitsLast24h: day.n,
      lastVisitAt: this.lastGlobalVisitAt(),
    };
  }
}
