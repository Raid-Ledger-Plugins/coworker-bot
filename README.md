# coworker-bot

Discord bot that drifts into voice channels every so often, mutters a line or
three in the voice of The Coworker (Abiotic Factor), and quietly disconnects.

Built as a NestJS module so that — should you ever want to — it can be lifted
into Raid Ledger's plugin host as a `ambient-discord-presence` capability
without restructuring. See `src/manifest.ts`.

## How it behaves

Every `TICK_INTERVAL_MS` (default 2 min) the scheduler:

1. Checks quiet hours, global cooldown, and whether a visit is already in
   progress — bail early if any apply.
2. Walks every voice channel in every enabled server, filters out
   muted/opted-out channels and channels that don't meet `MIN_OCCUPANTS`.
3. Rolls a `VISIT_PROBABILITY` die. Most ticks do nothing.
4. If the roll wins, joins the chosen channel, **listens** for ~7s,
   transcribes the audio with local whisper.cpp, picks a clip category from
   the transcript via a small keyword tree, plays 1–3 clips, lingers, and
   disconnects.

Cooldowns are recorded in sqlite so behavior survives restarts.

## Listening (contextual responses)

After joining, the bot records ~7s of mixed channel audio, runs it through
local whisper.cpp (`tiny.en` model), and matches the transcript against a
keyword tree to pick a clip category:

| If transcript contains...                       | Bot plays a clip from... |
| ----------------------------------------------- | ------------------------ |
| `stapler` / `office` / `meeting` / `coffee`     | `ty_stapler/`            |
| `thank` / `thanks` / `appreciate`               | `ty/`                    |
| `bye` / `goodbye` / `see ya` / `gtg` / `later`  | `bye/`                   |
| `hungry` / `starving` / `lunch` / `dinner`      | `idle_hungry/`           |
| `food` / `snack` / `larvae`                     | `hungry_larvae/`         |
| (silent or no match)                            | `idle/`                  |

`RANDOM_CLIP_PROBABILITY` (default 0.3) is the chance the keyword tree is
overridden with a fully-random pick — keeps the bot from feeling robotic when
the same word triggers the same category repeatedly. Set `LISTEN_ENABLED=false`
in `.env` to skip listening entirely (every visit becomes a random clip).

Audio is processed locally — no voice data leaves the host. The tree itself
lives at `src/listener/clip-selector.service.ts`; add new keyword rules there.

## Setup

### 1. Create the Discord bot

This bot is **separate from any other bot you run** — use a new application.

1. Go to <https://discord.com/developers/applications> → New Application →
   name it "The Coworker" (or whatever).
2. **Bot** tab → Add Bot → copy the token.
3. Toggle **Server Members Intent** ON (so the bot can see voice channel
   occupants). The bot doesn't need Message Content Intent.
4. **OAuth2 → URL Generator** → check `bot` + `applications.commands` scopes.
   Bot permissions: `View Channels`, `Connect`, `Speak`, `Use Voice Activity`.
   Open the generated URL, add to your server.

### 2. Configure

```bash
cp .env.example .env
# Fill in DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, ALLOWED_GUILD_IDS.
```

### 3. Install deps

```bash
npm install
```

If `@discordjs/opus` fails to build (it sometimes does on macOS without Xcode
command-line tools), the bot will fall back to `opusscript` automatically.
Install `opusscript` explicitly if needed: `npm i opusscript`.

### 4. Drop in some clips

Put .mp3/.ogg/.opus/.wav files in `clips/`. See `clips/README.md` for the
extraction walkthrough.

### 5. Set up whisper.cpp (for contextual responses)

```bash
brew install whisper-cpp
npm run setup-whisper        # downloads ggml-tiny.en (~75MB) into ./models/
```

Skip this step if you set `LISTEN_ENABLED=false` — the bot still works, it
just plays random clips with no listening.

### 6. Register slash commands

```bash
npm run register-commands
```

If `ALLOWED_GUILD_IDS` is set, commands register per-guild (instant). If empty,
they register globally (takes up to an hour to propagate).

### 7. Run

```bash
# dev mode (auto-restart on file changes)
npm run start:dev

# prod mode
npm run build && npm start
```

### 8. Enable the bot in your server

In Discord, run `/coworker enable` (requires Manage Server permission). The
bot won't visit anything until at least one server enables it.

## Slash commands

| Command | What it does |
|---------|-------------|
| `/coworker enable` | Allow the bot to visit voice channels in this server. |
| `/coworker disable` | Stop all ambient visits in this server. |
| `/coworker visit channel:#voice` | Force a visit now (admin override). |
| `/coworker stats` | Total visits, last 24h, last visit time, clips loaded. |
| `/coworker mute-channel channel:#voice` | Exclude a channel from ambient visits. |
| `/coworker unmute-channel channel:#voice` | Allow the channel again. |
| `/coworker reload-clips` | Re-scan `clips/` without a restart. |

All commands require **Manage Server** except `/coworker stats` which anyone
can run.

## Tuning behavior

Every knob lives in `.env`. Important ones:

- `VISIT_PROBABILITY=0.03` — at 2-min tick, ~3% × 30 ticks/hour ≈ one attempt
  per 1.1h *if* a target exists. Combined with `GLOBAL_COOLDOWN_MIN=90` you
  get roughly one visit every 90–120 min in active servers.
- `GLOBAL_COOLDOWN_MIN=90` — minimum minutes between any two visits.
- `CHANNEL_COOLDOWN_MIN=360` — minimum minutes between visits to the same
  channel.
- `QUIET_HOURS_START=03` / `QUIET_HOURS_END=10` — local hours (0–23) during
  which the bot will not visit. Set both to the same number to disable.
- `RESPECT_ACTIVE_CONVERSATION=true` — bot aborts after a 4s sample if anyone
  is actively talking. Flip to `false` for chaotic-evil mode.

## Architecture

```
src/
├── manifest.ts                       PluginManifest (RL plugin-host compatible)
├── main.ts                           Standalone bootstrap
├── app.module.ts                     Root NestJS module
├── config/coworker.config.ts         Env → typed config
├── bot/discord-client.service.ts     discord.js Client lifecycle
├── state/state-store.service.ts      better-sqlite3 — visits, opt-outs, enabled guilds
├── clips/clip-loader.service.ts      Scans clips/ folder, random picker
├── voice-activity/...                VoiceReceiver-based "are humans talking?" sampler
├── visit/visit-orchestrator.service  join → silence → play → linger → leave
├── scheduler/visit-eligibility       cooldowns, quiet hours, occupancy rules
├── scheduler/scheduler.service       periodic tick + probability gate
├── commands/coworker.commands.ts     /coworker slash-command handlers
└── scripts/register-commands.ts      Slash-command registration script
```

## Folding into Raid Ledger later

If you eventually want this to live inside Raid Ledger as a plugin:

1. `cp -r src api/src/plugins/coworker-bot/` (excluding `main.ts` and
   `scripts/`).
2. Register `AppModule`'s imports list in RL's `api/src/app.module.ts`.
3. Add `COWORKER_MANIFEST` to RL's plugin registry. The manifest shape already
   matches `PluginManifest` in
   `api/src/plugins/plugin-host/plugin-manifest.interface.ts`.
4. Replace `process.env` reads in `coworker.config.ts` with reads from RL's
   settings service (the `settingKeys` are already declared in the manifest).
5. Keep the bot token separate from RL's main bot — instantiate its own
   `Client`. Don't share `DiscordBotClient`.

## Known limitations / future work

- **Recording the reactions you join** was scoped out by design — adds
  consent/Discord-TOS overhead the friend-group scope doesn't need yet.
  If you change your mind, the receiver plumbing in
  `voice-activity.service.ts` already subscribes to per-user audio streams;
  decoding to WAV is a `prism-media` `OpusDecoder` + `fs.createWriteStream`
  away.
- **Weighted clip categories** — the picker treats all clips equally. Hooks
  exist in `clip-loader.service.ts` for category-aware picks; tag-based
  pacing (greeting → mundane → creepy → farewell) is left as future work.
- **Multi-bot conflict** — if your main bot also wants to be in the same
  channel as the Coworker, both will work, but Discord's voice gateway will
  show two bots in the channel. That's the point of separate bot identities.
