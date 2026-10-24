import zod from 'zod';

export enum ConfigChangeType {
  Move,
  Delete,
  Transform
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type TransformFunction = (value: JsonValue, config: JsonObject) => JsonValue;

export interface MigrationRuleMove {
  key: string;
  change: ConfigChangeType.Move;
}

export interface MigrationRuleDelete {
  change: ConfigChangeType.Delete;
}

export interface MigrationRuleTransform {
  key: string;
  change: ConfigChangeType.Transform;
  transform: TransformFunction;
}

export type MigrationRule = MigrationRuleMove | MigrationRuleDelete | MigrationRuleTransform;
export type MigrationMap = Record<string, MigrationRule>;

export const ConfigDiscordRoleId = zod.string().meta({ description: 'Discord role id' });
export const ConfigDiscordChannelId = zod.string().meta({ description: 'Discord channel id' });
export const ConfigDiscordChannelIdGenerate = zod
  .string()
  .nullable()
  .meta({ description: 'Discord channel id. If null, an auto-generated channel will be used' });
export const ConfigDiscordChannelIdGenerateThread = zod
  .string()
  .nullable()
  .meta({ description: 'Discord channel id. If null, an auto-generated thread will be used' });

export const ConfigDiscordEmbedsColors = zod.enum(['Blue', 'Gray', 'Green', 'Pink', 'Red', 'Yellow']);
export type ConfigDiscordEmbedsColors = zod.infer<typeof ConfigDiscordEmbedsColors>;
export const ConfigDiscordEmbeds = zod
  .object({
    colors: zod.record(ConfigDiscordEmbedsColors, zod.string()).meta({ description: 'The default colors for embeds' })
  })
  .meta({
    description:
      "Configuration options for embeds. Note that embeds aren't normally used in this project but the colors are used still"
  });
export const ConfigDiscordRoles = zod
  .object({
    polyfrostTeam: ConfigDiscordRoleId,
    moderator: ConfigDiscordRoleId,
    support: ConfigDiscordRoleId,
    noCounting: ConfigDiscordRoleId,
    noGiveaway: ConfigDiscordRoleId,
    devAccess: ConfigDiscordRoleId
  })
  .meta({ description: 'Configuration options the discord roles' });
export const ConfigDiscordChannels = zod
  .object({
    errorLog: ConfigDiscordChannelIdGenerate,
    support: ConfigDiscordChannelId,
    ticketLogs: ConfigDiscordChannelIdGenerate,
    botLogs: ConfigDiscordChannelIdGenerate,
    sparkAnalysis: ConfigDiscordChannelIdGenerate,
    sparkFixes: ConfigDiscordChannelIdGenerate
  })
  .meta({ description: 'Configuration options the discord channels' });
export const ConfigDiscord = zod
  .object({
    token: zod.string().meta({ description: 'The Discord bot token used to authenticate' }),
    serverId: zod.string().meta({ description: 'The Discord server (guild) ID' }),
    roles: ConfigDiscordRoles,
    channels: ConfigDiscordChannels,
    embeds: ConfigDiscordEmbeds,
    minecraftLogCleaner: zod.boolean().meta({ description: 'Should uploaded minecraft logs be cleaned' })
  })
  .meta({ description: 'Configuration options for discord related stuff' });

export const ConfigLogger = zod
  .object({
    saveToFiles: zod.boolean().meta({ description: 'Whether log output should be written to files' }),
    location: zod.string().meta({ description: 'The location of where these files should be saved' })
  })
  .meta({ description: 'Configuration options for the logger' });

export const ConfigOtherConfigBackups = zod
  .object({
    enabled: zod.boolean().meta({ description: 'Should config backups be made' }),
    location: zod.string().meta({ description: 'The location of where these files should be saved' })
  })
  .meta({ description: 'Configuration options for config backup system' });
export const ConfigOther = zod
  .object({
    configBackups: ConfigOtherConfigBackups,
    sqlitedb: zod.string().meta({ description: 'Path to the sqlite database' })
  })
  .meta({ description: "Configuration options for misc/other stuff or things that don't have a good location" });

export const ConfigSparkAnalysis = zod
  .object({
    enabled: zod.boolean().meta({ description: 'Should /spark analyze spark profiles with Claude' }),
    anthropicApiKey: zod.string().meta({ description: 'The Anthropic API key used to run the Claude agents' }),
    githubToken: zod
      .string()
      .nullable()
      .meta({ description: 'GitHub token used to read mod source code. If null, code search is unavailable' }),
    python: zod.string().meta({ description: 'The Python 3 command used to run the spark-analyzer skill script' })
  })
  .meta({ description: 'Configuration options for spark profile analysis' });

export const Config = zod.object({
  $schema: zod.string().meta({ description: '!IMPORTANT DO NOT TOUCH\nConfig schema format path' }),
  configVersion: zod
    .number()
    .int()
    .positive()
    .meta({ description: '!IMPORTANT DO NOT TOUCH\nConfig format version number' }),
  discord: ConfigDiscord,
  logger: ConfigLogger,
  sparkAnalysis: ConfigSparkAnalysis,
  other: ConfigOther
});
export type Config = zod.infer<typeof Config>;
