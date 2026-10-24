import PolyHelperError from '../private/error.ts';
import chalk from 'chalk';
import { DiscordjsError, type HexColorString, type RGBTuple } from 'discord.js';
import { ErrorEmbed } from '../discord/private/EmbedHelper.ts';
import type BasicInteractionMetadata from '../discord/private/interactions/basic/BasicInteractionMetadata.ts';
import type DiscordCommandMetadata from '../discord/private/interactions/commands/DiscordCommandMetadata.ts';
import type { DevData, ValidErrors } from '../types/application.ts';
import type { EmbedHelperField } from '../types/discord.ts';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getNestedValue(obj: unknown, path: string): unknown {
  let current = obj;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}

export function displayBigMessage(message: string) {
  const columns = process.stdout.columns;
  const warning = 'IMPORTANT!';
  const padding = ' '.repeat(Math.floor((columns - warning.length + 1) / 2));
  const padding2 = ' '.repeat(Math.floor((columns - message.length + 1) / 2));

  console.log(chalk.bgRed.black(' '.repeat(columns).repeat(3)));
  console.log(chalk.bgRed.black(padding + warning + padding));
  console.log(chalk.bgRed.black(padding2 + message + padding2));
  console.log(chalk.bgRed.black(' '.repeat(columns).repeat(3)));
}

export function getErrorString(error: Error): string {
  const message = error.toString();
  const stack = error.stack?.replaceAll(message, '').replaceAll('PolyHelperError:', '\nPolyHelperError:');
  return [message, stack, error.cause ? `Cause: ${String(error.cause)}` : undefined].filter(Boolean).join('');
}

export function getErrorTypeName(error: ValidErrors): string {
  if (error instanceof PolyHelperError) return 'PolyHelperError';
  else if (error instanceof DiscordjsError) return 'DiscordJsError';
  return 'Generic Error';
}

export function getCleanErrorEmbed(
  error: ValidErrors,
  metadata: BasicInteractionMetadata | DiscordCommandMetadata | null = null
) {
  const embed = new ErrorEmbed();
  if (!(error instanceof PolyHelperError)) {
    return embed.setDescription('This error has been reported to the devs. Please try again later.');
  }
  embed.setDescription(`\`\`\`${error.message}\`\`\``);
  if (metadata?.cleanErrorTitle) {
    embed.setTitle(`Unable to ${metadata.cleanErrorTitle}`).setDescription(error.message).setAuthor(null);
  }
  return embed;
}

export function getFullErrorEmbed(error: ValidErrors, extraData: EmbedHelperField[] = []): ErrorEmbed {
  const errorStack = error instanceof Error ? (error.stack ?? error.message) : String(error ?? 'Unknown');
  return new ErrorEmbed()
    .setDescription(`\`\`\`${errorStack}\`\`\``)
    .setFields(...[{ name: 'Error Type', value: getErrorTypeName(error) }, ...extraData]);
}

export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

export function hexToRgb(hex: HexColorString): RGBTuple {
  const value = hex.replace(/^#/, '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

export function convertDevDataToName({ discord, displayName }: DevData, includeMention: boolean = false): string {
  if (includeMention) {
    return `${discord !== undefined ? `${displayName} (@${discord.username} | <@${discord.id}>)` : displayName}`;
  }
  return `${discord !== undefined ? `${displayName} (@${discord.username})` : displayName}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
