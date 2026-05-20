# coworker-bot

A small Discord bot that drifts into voice channels every so often, mutters
a line or two as **The Coworker** (from [*Abiotic Factor*](https://store.steampowered.com/app/427920/Abiotic_Factor/)),
and quietly disconnects.

It listens to what's actually being said and tries to respond appropriately —
say *"thanks for the coffee"* in voice chat and the bot might pop in, play a
"you're welcome" line, and drift off.

> Built for laughs in a friend-group server. Not affiliated with the game,
> its publisher, or the voice actor.

## What it actually does

Every couple of minutes the bot rolls a probability die. About 3% of the time,
**if** a voice channel in a server it's been enabled in has at least 2 humans
in it, it:

1. Joins the channel
2. Records ~7 seconds of mixed audio
3. Transcribes the audio with local [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
4. Matches the transcript against a small keyword tree to pick a clip
   category
5. Plays 1–3 clips with short pauses between them
6. Lingers briefly, then disconnects

It won't revisit the same channel more than once every 6 hours, won't visit
at all during configurable quiet hours, and any admin can mute it per-channel
or per-server with a slash command.

All transcription runs **locally** — no voice data ever leaves the host.

### The keyword tree

| Heard...                                        | Plays a clip from... |
| ----------------------------------------------- | -------------------- |
| `stapler` / `office` / `meeting` / `coffee`     | `ty_stapler/`        |
| `thank` / `thanks` / `appreciate`               | `ty/`                |
| `bye` / `goodbye` / `see ya` / `gtg` / `later`  | `bye/`               |
| `hungry` / `starving` / `lunch` / `dinner`      | `idle_hungry/`       |
| `food` / `snack` / `larvae`                     | `hungry_larvae/`     |
| (silent channel or no keyword matched)          | `idle/`              |

About 30% of the time the keyword match is ignored and a random clip plays
anyway, so the same word doesn't always produce the same response.

## Run it yourself

### What you need

- A Discord application + bot user of your own (5-minute walkthrough below)
- Node.js 20+ and npm
- `ffmpeg` — `brew install ffmpeg` on macOS, `apt install ffmpeg` on Debian
- `whisper.cpp` — `brew install whisper-cpp` on macOS (the Docker path
  builds it from source for you)

### Quick start

```bash
git clone https://github.com/Raid-Ledger-Plugins/coworker-bot.git
cd coworker-bot
npm install
npm run setup-whisper           # downloads the ggml-tiny.en model (~75MB)

cp .env.example .env
# Fill in DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, and ALLOWED_GUILD_IDS

npm run register-commands       # registers /coworker slash commands
npm run start:dev               # runs in the foreground, auto-restarts on changes
```

Then in Discord, run `/coworker enable` (requires the Manage Server
permission). The bot won't visit anything until at least one server runs
that command.

To test immediately without waiting for the probability roll, run
`/coworker visit channel:#some-voice-channel`.

### Creating the Discord bot user

This bot needs its **own** Discord application — don't reuse a token from
another bot you run.

1. Visit <https://discord.com/developers/applications> → **New Application**
   → name it whatever
2. **Bot** tab → **Reset Token** → copy it. That goes into `.env` as
   `DISCORD_BOT_TOKEN`. Discord only shows the token once.
3. On the same tab, toggle **Server Members Intent** ON. (Lets the bot see
   who's in voice channels. It does *not* need Message Content Intent.)
4. **General Information** tab → copy the **Application ID** into `.env`
   as `DISCORD_CLIENT_ID`
5. **OAuth2 → URL Generator** → check the `bot` and `applications.commands`
   scopes, then under *Bot Permissions* check `View Channels`, `Connect`,
   `Speak`, and `Use Voice Activity`. Open the generated URL in a browser
   and add the bot to your server.

### Finding your server ID

In Discord, **Settings → Advanced → Developer Mode** (toggle on). Then
right-click your server icon → **Copy Server ID**. Paste that value into
`.env` as `ALLOWED_GUILD_IDS`. (If you leave that blank, the bot can be
added to any server, and slash commands take up to an hour to propagate
globally instead of registering instantly per-guild.)

## Deploy (run always-on)

`npm run start:dev` is great for trying it out, but it stops the moment you
close your terminal. Two options to keep it running.

### Docker (recommended)

The included `Dockerfile` builds whisper.cpp from source, pre-downloads the
model, and produces a self-contained image. The included `docker-compose.yml`
wires up restart-on-failure and a persistent volume for the sqlite DB.

```bash
# Fill in your .env first (same as the quick-start step above)
cp .env.example .env
# Edit .env with your Discord credentials

# Build and start
docker compose up -d --build

# Watch the logs
docker compose logs -f

# Update later
git pull && docker compose up -d --build

# Stop
docker compose down
```

The bot only makes **outbound** connections to Discord's gateway — no ports
need to be exposed. The `./data/` directory on the host is mounted into the
container so the cooldown / opt-out database survives restarts.

This deploys cleanly to a Synology NAS, a small VPS, or any other Docker
host.

### macOS launchd (always-on on your Mac)

If you'd rather run it on your Mac in the background and have it auto-start
on login:

```bash
# Build the production bundle first
npm run build

# Copy the template and edit the four REPLACE_ME paths in it
cp scripts/com.coworker-bot.plist.template ~/Library/LaunchAgents/com.coworker-bot.plist
open -e ~/Library/LaunchAgents/com.coworker-bot.plist
```

You'll need to substitute the absolute path to this repo (run `pwd` from
inside the repo) and the absolute path to your `node` binary (run
`which node` — typically `/opt/homebrew/bin/node` on Apple Silicon).

```bash
# Load it
launchctl load -w ~/Library/LaunchAgents/com.coworker-bot.plist

# Tail the logs
tail -f data/launchd.stdout.log data/launchd.stderr.log

# Stop and unload
launchctl unload ~/Library/LaunchAgents/com.coworker-bot.plist
```

## Slash commands

| Command | What it does |
|---------|--------------|
| `/coworker enable` | Allow the bot to visit voice channels in this server |
| `/coworker disable` | Stop all ambient visits in this server |
| `/coworker visit channel:#voice` | Force a visit now — useful for testing |
| `/coworker stats` | Total visits, last 24h, last visit time, clips loaded |
| `/coworker mute-channel channel:#voice` | Skip a specific voice channel forever |
| `/coworker unmute-channel channel:#voice` | Reverse the above |
| `/coworker reload-clips` | Re-scan `clips/` without restarting the bot |

All commands require Manage Server permission, except `/coworker stats`
which anyone can run.

## Tuning

Every behavior knob is an environment variable in `.env`. Open
[`.env.example`](.env.example) for the full list, all with comments. The
ones you're most likely to touch:

- `VISIT_PROBABILITY` — chance of attempting a visit on any tick (default `0.03`)
- `GLOBAL_COOLDOWN_MIN` / `CHANNEL_COOLDOWN_MIN` — minimum minutes between visits
- `QUIET_HOURS_START` / `QUIET_HOURS_END` — hours during which the bot won't visit
- `LISTEN_ENABLED` — set to `false` to skip transcription (every visit becomes random)
- `RANDOM_CLIP_PROBABILITY` — chance to override the keyword match with a random pick

## Extending the keyword tree

The whole tree lives in
[`src/listener/clip-selector.service.ts`](src/listener/clip-selector.service.ts).
Each rule is a list of keywords mapped to a category, which is the name of
a subfolder under `clips/`. Order matters — more-specific rules go first
(so *"thanks for the stapler"* picks `ty_stapler/`, not `ty/`).

To add a new category:

1. Create `clips/<your-category>/` and drop your audio files in
2. Add a rule pointing at that category in `clip-selector.service.ts`
3. Restart the bot, or run `/coworker reload-clips`

## Architecture

```
src/
├── manifest.ts                              Plugin manifest (see footer)
├── main.ts                                  Standalone bootstrap
├── app.module.ts                            Root NestJS module
├── config/coworker.config.ts                Env → typed config
├── bot/discord-client.service.ts            discord.js Client lifecycle
├── state/state-store.service.ts             better-sqlite3: visits, opt-outs
├── clips/clip-loader.service.ts             Scans clips/, category-aware picker
├── listener/
│   ├── audio-recorder.service.ts            VoiceReceiver → ffmpeg → WAV
│   ├── transcriber.service.ts               whisper-cli subprocess
│   ├── clip-selector.service.ts             Keyword tree → category
│   └── listener.service.ts                  Orchestrator + random override
├── visit/visit-orchestrator.service.ts      Join → listen → play → linger → leave
├── scheduler/scheduler.service.ts           Periodic tick + probability gate
├── scheduler/visit-eligibility.service.ts   Cooldowns, quiet hours, occupancy
└── commands/coworker.commands.ts            /coworker slash-command handlers
```

## Further reading

- [`docs/raid-ledger-integration.md`](docs/raid-ledger-integration.md) —
  how to lift this code into Raid Ledger's plugin host
- [`docs/design-notes.md`](docs/design-notes.md) — calibration math,
  known limitations, possible future directions
- [`clips/README.md`](clips/README.md) — how the bundled clips were made
  and how to add your own

## Credits

- Voice clips extracted from this great fan compilation:
  ["Abiotic Factor — Coworker Voice Lines"](https://www.youtube.com/watch?v=nTe8fy4sadg)
  by CloseDatMouf
- Original game audio © **Deep Field Games / Playstack**.
  *Abiotic Factor* is on [Steam](https://store.steampowered.com/app/427920/Abiotic_Factor/)
- Transcription: [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- Discord library: [discord.js](https://discord.js.org) +
  [@discordjs/voice](https://github.com/discordjs/voice)

If you're a rights-holder and want any of the bundled clips removed, please
open an issue.

---

<sub>This repo lives under the [Raid-Ledger-Plugins](https://github.com/Raid-Ledger-Plugins)
org because the plugin manifest in <code>src/manifest.ts</code> follows
[Raid Ledger](https://github.com/sjdodge123/Raid-Ledger)'s plugin-host
interface shape. The maintainer of that project may eventually fold this
bot in as an extension; for everyone else, it's just a standalone Discord
bot with no Raid Ledger dependency at runtime.</sub>
