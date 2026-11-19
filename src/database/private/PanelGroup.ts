import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Message,
  StringSelectMenuBuilder,
  TextChannel
} from 'discord.js';
import { OpenTicketButton, PanelStringSelectMenu } from '../../discord/private/ComponentHelper.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type Panel from './Panel.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabasePanelGroup } from '../../types/database.ts';

class PanelGroup extends BaseParsedDatabaseItem<DatabasePanelGroup> {
  readonly name: DatabasePanelGroup['name'];
  readonly channelId: DatabasePanelGroup['channelId'];
  readonly messageId: DatabasePanelGroup['messageId'];
  constructor(data: DatabasePanelGroup, manager: DatabaseManager) {
    super(data, manager);
    this.name = data.name;
    this.channelId = data.channelId;
    this.messageId = data.messageId;
  }

  get panels(): Panel[] {
    return this.manager.getPanels({ panelGroupId: this.id });
  }

  async getChannel(): Promise<TextChannel> {
    if (!this.manager.application.discord.isGuildReady()) {
      throw new PolyHelperError("The discord bot doesn't seam to be online? Please restart the application");
    }
    const channel = await this.manager.application.discord.guild.channels.fetch(this.channelId);
    if (!channel) throw new PolyHelperError('Could not find the linked channel for this panel group');
    if (!channel.isSendable() || channel.type !== ChannelType.GuildText) {
      throw new PolyHelperError('The linked channel is the wrong type. Please use a guild text channel');
    }
    return channel;
  }

  async getMessage(): Promise<Message> {
    const channel = await this.getChannel();
    if (this.messageId === null) {
      const message = await channel.send({ content: 'Setting up panels message' });
      this.manager.updatePanelGroup({ ...this.toJSON(), messageId: message.id });
      return message;
    }
    const message = await channel.messages.fetch(this.messageId).catch(() => null);
    if (!message) return await this.manager.updatePanelGroup({ ...this.toJSON(), messageId: null }).getMessage();
    return message;
  }

  async updateMessage(): Promise<Message> {
    const panels = this.manager.getPanels({ panelGroupId: this.id, sort: 'None' });
    const message = await this.getMessage();
    return await message.edit({
      content: '',
      embeds: [
        new EmbedHelper()
          .setTitle(`${message.client.discordManager.guild?.name ?? 'UNKNOWN'} ${this.name} Tickets`)
          .setColor('Blue')
          .setFields(...panels.map((panel) => ({ name: `**${panel.title}**`, value: panel.description })))
      ],
      components:
        panels.length === 0
          ? []
          : [new ActionRowBuilder<ButtonBuilder>().addComponents(panels.map((panel) => OpenTicketButton(panel)))]
    });
  }

  override toEmbed(): EmbedHelper {
    return super
      .toEmbed()
      .setTitle('Showing Panel Group Data')
      .addFields(
        { name: 'Name', value: this.name, format: 'Block' },
        { name: 'Channel', value: this.channelId, format: 'Discord Channel' },
        { name: 'Amount of Panels', value: this.panels.length, format: 'Number Small Block' }
      );
  }

  override toMessageData(): BaseMessageOptions {
    return {
      embeds: [this.toEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Edit').setStyle(ButtonStyle.Secondary).setCustomId(`editPanelGroup:${this.id}`),
          new ButtonBuilder()
            .setLabel('Refresh Message')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`refreshPanelGroupMessage:${this.id}`),
          new ButtonBuilder()
            .setLabel('View Overview')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`viewPanelGroupOverview:${this.id}`)
        ),
        this.getRefreshExportRow('panelGroup'),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          PanelStringSelectMenu(this.panels)
            .setCustomId('selectPanel')
            .setPlaceholder('View a Panel')
            .setMinValues(1)
            .setMaxValues(1)
        )
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: this.name, value: this.id };
  }

  override toJSON(): DatabasePanelGroup {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      name: this.name,
      channelId: this.channelId,
      messageId: this.messageId
    };
  }
}

export default PanelGroup;
