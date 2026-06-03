import 'dotenv/config';
import {
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from 'discord.js';

function buildCommand(): SlashCommandBuilder {
  const builder = new SlashCommandBuilder()
    .setName('coworker')
    .setDescription('Manage the ambient Coworker bot');

  const addVoiceChannelOption = (
    sub: SlashCommandSubcommandBuilder,
    name: string,
    description: string,
  ): SlashCommandSubcommandBuilder =>
    sub.addChannelOption((opt) =>
      opt
        .setName(name)
        .setDescription(description)
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
    );

  const addTextChannelOption = (
    sub: SlashCommandSubcommandBuilder,
    name: string,
    description: string,
  ): SlashCommandSubcommandBuilder =>
    sub.addChannelOption((opt) =>
      opt
        .setName(name)
        .setDescription(description)
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    );

  const addAnyChannelOption = (
    sub: SlashCommandSubcommandBuilder,
    name: string,
    description: string,
  ): SlashCommandSubcommandBuilder =>
    sub.addChannelOption((opt) =>
      opt
        .setName(name)
        .setDescription(description)
        .setRequired(true)
        .addChannelTypes(
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice,
          ChannelType.GuildText,
        ),
    );

  builder.addSubcommand((s) =>
    s.setName('enable').setDescription('Enable the Coworker for this server'),
  );
  builder.addSubcommand((s) =>
    s.setName('disable').setDescription('Disable the Coworker for this server'),
  );
  builder.addSubcommand((s) =>
    addVoiceChannelOption(
      s.setName('visit').setDescription('Force a visit to a voice channel now'),
      'channel',
      'Voice channel to visit',
    ),
  );
  builder.addSubcommand((s) =>
    addTextChannelOption(
      s
        .setName('post')
        .setDescription('Force a text post to a text channel now'),
      'channel',
      'Text channel to post in',
    ),
  );
  builder.addSubcommand((s) =>
    s.setName('stats').setDescription('Show visit and text-post stats'),
  );
  builder.addSubcommand((s) =>
    addAnyChannelOption(
      s
        .setName('mute-channel')
        .setDescription('Stop the bot from visiting or posting in a channel'),
      'channel',
      'Voice or text channel to mute',
    ),
  );
  builder.addSubcommand((s) =>
    addAnyChannelOption(
      s
        .setName('unmute-channel')
        .setDescription('Allow the bot to use a channel again'),
      'channel',
      'Voice or text channel to unmute',
    ),
  );
  builder.addSubcommand((s) =>
    s
      .setName('reload-clips')
      .setDescription('Re-scan the clips folder without restarting'),
  );
  builder.addSubcommand((s) =>
    s
      .setName('reload-lines')
      .setDescription('Re-scan the lines folder without restarting'),
  );

  return builder;
}

async function main(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildIds = (process.env.ALLOWED_GUILD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token || !clientId) {
    throw new Error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID required');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = [buildCommand().toJSON()];

  if (guildIds.length === 0) {
    // eslint-disable-next-line no-console
    console.log('registering global command (may take up to an hour to appear)');
    await rest.put(Routes.applicationCommands(clientId), { body });
  } else {
    for (const gid of guildIds) {
      // eslint-disable-next-line no-console
      console.log(`registering guild command in ${gid}`);
      await rest.put(Routes.applicationGuildCommands(clientId, gid), { body });
    }
  }
  // eslint-disable-next-line no-console
  console.log('done');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
