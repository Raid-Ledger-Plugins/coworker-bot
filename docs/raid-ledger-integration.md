# Folding into Raid Ledger as a plugin

This bot is structured as a NestJS module with a plugin manifest whose shape
matches [Raid Ledger](https://github.com/sjdodge123/Raid-Ledger)'s
`PluginManifest` interface (see `src/manifest.ts`). If you ever want to lift
this code into Raid Ledger as a first-class plugin rather than a separate
process, the structural lift is small.

## Steps

1. **Copy the source tree** into RL's plugin host:

   ```bash
   cp -r src api/src/plugins/coworker-bot/
   ```

   Skip `src/main.ts` and `src/scripts/` — the standalone bootstrap and the
   one-shot command-registration script aren't needed inside RL.

2. **Register the module** in RL's `api/src/app.module.ts` — add
   `CoworkerBotAppModule` (or rename `AppModule` from `src/app.module.ts`
   when copying) to RL's root module imports.

3. **Register the manifest** with RL's plugin registry. The shape of
   `COWORKER_MANIFEST` already matches RL's `PluginManifest` interface at
   `api/src/plugins/plugin-host/plugin-manifest.interface.ts`, so this is a
   one-liner.

4. **Switch from env vars to RL's settings service.** The current
   `coworker.config.ts` reads from `process.env`. Inside RL, the
   `settingKeys` declared in the manifest (`coworker_bot_token`,
   `coworker_visit_probability`, etc.) are already wired into the
   `app_settings` table — read from the settings service instead. The
   token-handling pattern in RL's `DiscordModule` (using `Settings`
   abstractions for credentials) is the right reference.

5. **Keep the bot token separate from RL's main bot.** Even though both
   bots live in the same NestJS process, they should be **distinct Discord
   applications with distinct tokens**. Instantiate a second
   `discord.js` `Client` rather than reusing RL's `DiscordBotClient`. RL's
   main bot has serious responsibilities (event signups, voice tracking,
   notifications, etc.) — you don't want this bot's "wanders in and mutters"
   behavior tied to that identity.

## Why a separate bot identity, not just a capability on the existing bot?

Same reason corporations don't have the marketing intern run the legal
hotline. The Coworker is an absurdity; RL's main bot is operational
infrastructure. Mixing their voice presence in a channel would break the
mental model for users ("did the Raid Ledger bot just say *'thanks for the
stapler'*?") and risk one bug taking down both surfaces. Keeping them as
distinct Discord users is cheap and surface-clean.
