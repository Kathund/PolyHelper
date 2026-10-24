import config from '../../../config.json' with { type: 'json' };
import {
  type APIEmbed,
  type APIEmbedField,
  type ColorResolvable,
  EmbedBuilder,
  type EmbedData,
  type RestOrArray
} from 'discord.js';
import { CommonDevs, EmbedStyles } from '../../private/constants.ts';
import { ConfigDiscordEmbedsColors } from '../../types/config.ts';
import { type DevData, type DevName } from '../../types/application.ts';
import type Ticket from '../../database/private/Ticket.ts';
import type { EmbedHelperField, EmbedStyleData, EmbedStyleName } from '../../types/discord.ts';

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
    }
    return value;
  }

  setAIFooter(message: string = 'AI-generated. Check it before acting on it.'): this {
    this.setFooter({ text: `⚠️ ${message}` });
    return this;
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

export class TicketEmbed extends SuccessEmbed {
  constructor(ticket: Ticket) {
    super();
    this.setStyle('Ticket');
    this.addFields(
      { name: 'Ticket ID', value: ticket.id, format: 'Block' },
      { name: 'Panel ID', value: ticket.panelId, format: 'Block' },
      { name: 'Thread', value: `<#${ticket.threadId}>` },
      { name: 'Open Timestamp', value: Math.floor(ticket.openingTimestamp / 1000), format: 'Timestamp' },
      { name: 'Ticket Owner', value: ticket.owner, format: 'Discord User' },
      { name: 'Is Closed', value: ticket.closed, format: 'Boolean' },
      { name: 'Is Pinned', value: ticket.pinned, format: 'Boolean' }
    );
  }
}
