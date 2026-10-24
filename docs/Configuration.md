# Configuration

This document is generated from the Zod config schema in [`src/types/config.ts`](/src/types/config.ts)

# <Root>

| Key             | Type     | Description                                                                          |
| --------------- | -------- | ------------------------------------------------------------------------------------ |
| `$schema`       | `string` | !IMPORTANT DO NOT TOUCH Config schema format path                                    |
| `configVersion` | `number` | !IMPORTANT DO NOT TOUCH Config format version number                                 |
| `discord`       | `object` | Configuration options for discord related stuff                                      |
| `logger`        | `object` | Configuration options for the logger                                                 |
| `sparkAnalysis` | `object` | Configuration options for spark profile analysis                                     |
| `other`         | `object` | Configuration options for misc/other stuff or things that don't have a good location |

## discord

| Key                   | Type      | Description                                                                                                           |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `token`               | `string`  | The Discord bot token used to authenticate                                                                            |
| `serverId`            | `string`  | The Discord server (guild) ID                                                                                         |
| `roles`               | `object`  | Configuration options the discord roles                                                                               |
| `channels`            | `object`  | Configuration options the discord channels                                                                            |
| `embeds`              | `object`  | Configuration options for embeds. Note that embeds aren't normally used in this project but the colors are used still |
| `minecraftLogCleaner` | `boolean` | Should uploaded minecraft logs be cleaned                                                                             |

### roles

| Key             | Type     | Description     |
| --------------- | -------- | --------------- |
| `polyfrostTeam` | `string` | Discord role id |
| `moderator`     | `string` | Discord role id |
| `support`       | `string` | Discord role id |
| `noCounting`    | `string` | Discord role id |
| `noGiveaway`    | `string` | Discord role id |
| `devAccess`     | `string` | Discord role id |

### channels

| Key             | Type             | Description                                                         |
| --------------- | ---------------- | ------------------------------------------------------------------- |
| `errorLog`      | `string OR null` | Discord channel id. If null, an auto-generated channel will be used |
| `support`       | `string`         | Discord channel id                                                  |
| `ticketLogs`    | `string OR null` | Discord channel id. If null, an auto-generated channel will be used |
| `botLogs`       | `string OR null` | Discord channel id. If null, an auto-generated channel will be used |
| `sparkAnalysis` | `string OR null` | Discord channel id. If null, an auto-generated channel will be used |
| `sparkFixes`    | `string OR null` | Discord channel id. If null, an auto-generated channel will be used |

### embeds

| Key      | Type                     | Description                   |
| -------- | ------------------------ | ----------------------------- |
| `colors` | `record<string, string>` | The default colors for embeds |

## logger

| Key           | Type      | Description                                       |
| ------------- | --------- | ------------------------------------------------- |
| `saveToFiles` | `boolean` | Whether log output should be written to files     |
| `location`    | `string`  | The location of where these files should be saved |

## sparkAnalysis

| Key               | Type             | Description                                                                    |
| ----------------- | ---------------- | ------------------------------------------------------------------------------ |
| `enabled`         | `boolean`        | Should /spark analyze spark profiles with Claude                               |
| `anthropicApiKey` | `string`         | The Anthropic API key used to run the Claude agents                            |
| `githubToken`     | `string OR null` | GitHub token used to read mod source code. If null, code search is unavailable |
| `python`          | `string`         | The Python 3 command used to run the spark-analyzer skill script               |

## other

| Key             | Type     | Description                                    |
| --------------- | -------- | ---------------------------------------------- |
| `configBackups` | `object` | Configuration options for config backup system |
| `sqlitedb`      | `string` | Path to the sqlite database                    |

### configBackups

| Key        | Type      | Description                                       |
| ---------- | --------- | ------------------------------------------------- |
| `enabled`  | `boolean` | Should config backups be made                     |
| `location` | `string`  | The location of where these files should be saved |

---

This document is [auto generated](/scripts/docs/Configuration.ts) and was last updated on
`Fri, 23 Oct 2026 04:29:45 GMT` (`1792729785344`)

To update this document please run `pnpm docgen` or contact a maintainer and ask them to update it.

---

Feel free to reach out to the maintainers directly on Discord.
[@amber.rip](https://discord.com/users/1276524855445164098), [@ruintd](https://discord.com/users/157917665162297344)
