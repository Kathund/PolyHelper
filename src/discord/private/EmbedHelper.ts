import config from '../../../config.json' with { type: 'json' };
import {
  type APIEmbed,
  type APIEmbedField,
  type ColorResolvable,
  EmbedBuilder,
  type EmbedData,
  type RestOrArray,
  User
} from 'discord.js';
import { CommonDevs, EmbedStyles } from '../../private/constants.ts';
import { ConfigDiscordEmbedsColors } from '../../types/config.ts';
import { getFullUserDisplayName, getMention } from '../../utils/discordUtils.ts';
import { getReason } from '../../utils/stringUtils.ts';
import type { DevData, DevName } from '../../types/application.ts';
import type { EmbedHelperField, EmbedStyleData, EmbedStyleName } from '../../types/discord.ts';
import type { TicketAction } from '../../types/misc.ts';

export default class EmbedHelper extends EmbedBuilder {
  static embedDescriptionLimit = 4096;
  constructor(data?: EmbedData | APIEmbed) {
    super(data);
    if (data) return;
    this.setTimestamp();
    this.setStyle('Generic');
  }

  override setColor(color: ConfigDiscordEmbedsColors | ColorResolvable | null): this {
    if (ConfigDiscordEmbedsColors.safeParse(color).success) {
      return super.setColor(config.discord.embeds.colors[color as ConfigDiscordEmbedsColors] as ColorResolvable);
    }

    return super.setColor(color as ColorResolvable);
  }

  setDevFooter(data: DevName | DevData | null, message: string = 'Consider checking out /about'): this {
    if (data === null) return this.setFooter(null);
    const dev = (typeof data === 'string' ? CommonDevs[data] : data) as DevData;
    const { displayName, discord, avatarURL } = dev;
    const username = discord ? `@${discord.username}` : displayName;
    return this.setFooter({ text: `by ${username} | ${message}`, iconURL: avatarURL });
  }

  setStyle(data: EmbedStyleName | EmbedStyleData): this {
    const { title, author, description, color, footer, footerMessage, timestamp } = (
      typeof data === 'string' ? EmbedStyles[data] : data
    ) as EmbedStyleData;
    this.setTitle(title ?? null);
    this.setAuthor(author ?? null);
    this.setDescription(description ?? null);
    this.setColor(color ?? null);
    this.setDevFooter(footer ?? null, footerMessage);
    this.setTimestamp(timestamp === 'Now' ? Date.now() : (timestamp ?? null));
    return this;
  }

  override setFields(...fields: RestOrArray<APIEmbedField>): this;
  override setFields(...fields: RestOrArray<EmbedHelperField>): this;
  override setFields(...fields: RestOrArray<APIEmbedField | EmbedHelperField>): this {
    const normalizedFields = Array.isArray(fields[0]) ? fields[0] : fields;
    return super.setFields(normalizedFields.map((field) => this.formatField(field as EmbedHelperField)));
  }

  override addFields(...fields: RestOrArray<APIEmbedField>): this;
  override addFields(...fields: RestOrArray<EmbedHelperField>): this;
  override addFields(...fields: RestOrArray<APIEmbedField | EmbedHelperField>): this {
    const normalizedFields = Array.isArray(fields[0]) ? fields[0] : fields;
    return super.addFields(normalizedFields.map((field) => this.formatField(field as EmbedHelperField)));
  }

  get fields(): APIEmbedField[] {
    return this.toJSON().fields ?? [];
  }

  private formatField(data: EmbedHelperField): APIEmbedField {
    return { name: data.name, value: this.formatFieldValue(data), inline: data.inline };
  }

  private formatFieldValue({ value, format }: EmbedHelperField): string {
    if (format === 'Small Block') {
      return `\`${value}\``;
    } else if (format === 'Block') {
      return `\`\`\`${value}\`\`\``;
    } else if (format === 'Timestamp') {
      return `<t:${value}:F> (<t:${value}:R>)`;
    } else if (format === 'Boolean') {
      return value ? ':white_check_mark: Yes' : ':x: No';
    } else if (format === 'Discord User') {
      return typeof value === 'string'
        ? `<@${value}> (\`${value}\`)`
        : `\`@${value.username}\` (\`${value.id}\`) <@${value.id}>`;
    } else if (format === 'Discord Role') {
      return typeof value === 'string'
        ? `<@&${value}> (\`${value}\`)`
        : `\`@${value.name}\` (\`${value.id}\`) <@&${value.id}>`;
    } else if (format === 'Discord Channel') {
      return typeof value === 'string'
        ? `<#${value}> (\`${value}\`)`
        : `\`${'name' in value ? value.name : 'UNKNOWN'}\` (\`${value.id}\`) <#${value.id}>`;
    } else if (format === 'Discord Guild') {
      return typeof value === 'string' ? `\`${value}\`` : `\`@${value.name}\` (\`${value.id}\`)`;
    }
    return String(value);
  }
}

export class WarningEmbed extends EmbedHelper {
  constructor() {
    super();
    this.setStyle('Warning');
  }
}

export class ErrorEmbed extends EmbedHelper {
  constructor() {
    super();
    this.setStyle('Error');
  }
}

export class SuccessEmbed extends EmbedHelper {
  constructor() {
    super();
    this.setStyle('Success');
  }
}

export class TicketActionEmbed extends EmbedHelper {
  constructor({
    reason,
    executor,
    title,
    fullTitleReplace,
    description
  }: TicketAction & { title: string; fullTitleReplace?: boolean; description?: string }) {
    super();
    this.setTitle(fullTitleReplace === true ? title : `Ticket ${title}`);
    this.setDescription(description ?? `This ticket has been ${title.toLowerCase()} by ${getMention(executor)}`);
    this.setFields({ name: 'Reason', value: getReason(reason), format: 'Block' });
    if (executor instanceof User) {
      this.setAuthor({ name: getFullUserDisplayName(executor), url: executor.displayAvatarURL() });
    }
  }
}
