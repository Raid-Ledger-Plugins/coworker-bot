/**
 * Plugin manifest — shape mirrors Raid Ledger's PluginManifest interface
 * (api/src/plugins/plugin-host/plugin-manifest.interface.ts).
 *
 * Used standalone today; when this module is dropped into Raid Ledger as
 * a plugin, the RL plugin host can register this manifest directly.
 */
export interface PluginIntegration {
  key: string;
  name: string;
  description: string;
  icon?: string;
  credentialKeys: string[];
  credentialLabels: string[];
  settingsEvent?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { name: string; url?: string };
  gameSlugs?: string[];
  capabilities: string[];
  settingKeys?: string[];
  integrations?: PluginIntegration[];
  dependencies?: string[];
}

export const COWORKER_MANIFEST: PluginManifest = {
  id: 'coworker-bot',
  name: 'The Coworker',
  version: '0.1.0',
  description:
    'Ambient Discord presence — drifts into voice channels and mutters lines from The Coworker (Abiotic Factor).',
  author: { name: 'gamernight' },
  capabilities: ['ambient-discord-presence'],
  settingKeys: [
    'coworker_bot_token',
    'coworker_client_id',
    'coworker_visit_probability',
    'coworker_global_cooldown_min',
    'coworker_channel_cooldown_min',
    'coworker_min_occupants',
    'coworker_quiet_hours_start',
    'coworker_quiet_hours_end',
  ],
  integrations: [
    {
      key: 'coworker-discord',
      name: 'Coworker Bot',
      description: 'Second Discord bot identity used for ambient voice visits.',
      credentialKeys: ['coworker_bot_token', 'coworker_client_id'],
      credentialLabels: ['Bot Token', 'Client ID'],
      settingsEvent: 'settings.coworker.updated',
    },
  ],
};
