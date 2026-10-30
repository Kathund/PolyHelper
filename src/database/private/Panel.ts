import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import { ActionRowBuilder, type BaseMessageOptions, ButtonBuilder, ButtonStyle, type User } from 'discord.js';
import { convertButtonStyleToHuman } from '../../utils/discordUtils.ts';
import { replaceVariables } from '../../utils/stringUtils.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type SupportTeam from './SupportTeam.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabasePanel, TicketSearchFilters } from '../../types/database.ts';
import type { TemplatePrimitive } from '../../types/misc.ts';

class Panel extends BaseParsedDatabaseItem<DatabasePanel> {
  readonly id: DatabasePanel['id'];
  readonly name: DatabasePanel['name'];
  readonly title: DatabasePanel['title'];
  readonly description: DatabasePanel['description'];
  readonly buttonLabel: DatabasePanel['buttonLabel'];
  readonly buttonEmoji: DatabasePanel['buttonEmoji'];
  readonly buttonStyle: DatabasePanel['buttonStyle'];
  readonly openingMessage: DatabasePanel['openingMessage'];
  readonly openingMessageContent: DatabasePanel['openingMessageContent'];
  readonly openingMessageTitle: DatabasePanel['openingMessageTitle'];
  readonly maxOpenTickets: DatabasePanel['maxOpenTickets'];
  readonly pinnedTicketPrefix: DatabasePanel['pinnedTicketPrefix'];
  readonly closedTicketPrefix: DatabasePanel['closedTicketPrefix'];
  readonly defaultTicketName: DatabasePanel['defaultTicketName'];
  readonly #pingSupportTeamOnOpen: DatabasePanel['pingSupportTeamOnOpen'];
  readonly supportTeamId: DatabasePanel['supportTeamId'];
  readonly #enabled: DatabasePanel['enabled'];
  constructor(
    data: DatabasePanel,
    private readonly manager: DatabaseManager
  ) {
    super();
    this.id = data.id;
    this.name = data.name;
    this.title = data.title;
    this.description = data.description;
    this.buttonLabel = data.buttonLabel;
    this.buttonEmoji = data.buttonEmoji;
    this.buttonStyle = data.buttonStyle;
    this.openingMessage = data.openingMessage;
    this.openingMessageContent = data.openingMessageContent;
    this.openingMessageTitle = data.openingMessageTitle;
    this.maxOpenTickets = data.maxOpenTickets;
    this.pinnedTicketPrefix = data.pinnedTicketPrefix;
    this.closedTicketPrefix = data.closedTicketPrefix;
    this.defaultTicketName = data.defaultTicketName;
    this.#pingSupportTeamOnOpen = data.pingSupportTeamOnOpen;
    this.supportTeamId = data.supportTeamId;
    this.#enabled = data.enabled;
  }

  get fullClosedTicketPrefix(): string {
    return `[${this.closedTicketPrefix}]`;
  }

  get fullPinnedTicketPrefix(): string {
    return `[${this.pinnedTicketPrefix}]`;
  }

  get pingSupportTeamOnOpen(): boolean {
    return Boolean(this.#pingSupportTeamOnOpen);
  }

  get enabled(): boolean {
    return Boolean(this.#enabled);
  }

  get supportTeam(): SupportTeam | null {
    if (this.supportTeamId === null) return null;
    const supportTeam = this.manager.getSupportTeam(this.supportTeamId);
    if (!supportTeam) throw new PolyHelperError('Could not find the matching support team?');
    return supportTeam;
  }

  getStartingMessageData(user: User): BaseMessageOptions {
    const variables: Readonly<Record<string, TemplatePrimitive>> = {
      panelName: this.name,
      mention: `<@${user.id}>`,
      username: user.username,
      id: user.id
    };
    return {
      content: `<@${user.id}>`,
      embeds: [
        new EmbedHelper()
          .setColor('Green')
          .setTitle(replaceVariables(this.openingMessageTitle, variables))
          .setDescription(replaceVariables(this.openingMessage, variables))
      ]
    };
  }

  getTickets(filters: Omit<TicketSearchFilters, 'panelId'> = {}) {
    return this.manager.getTickets({ ...filters, panelId: this.id });
  }

  getOverviewFields(): {
    id: DatabasePanel['id'];
    name: DatabasePanel['name'];
    enabled: boolean;
    tickets: number;
    openTickets: number;
    pinnedTickets: number;
  } {
    const tickets = this.getTickets();
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      tickets: tickets.length,
      openTickets: tickets.filter((ticket) => !ticket.closed).length,
      pinnedTickets: tickets.filter((ticket) => ticket.pinned).length
    };
  }

  parseTicketName({ user, shouldReplaceVariables }: { user: User; shouldReplaceVariables?: boolean }): string {
    if (!shouldReplaceVariables) return this.defaultTicketName;
    return replaceVariables(this.defaultTicketName, {
      username: user.username,
      id: user.id,
      panelName: this.name,
      cleanPanelName: this.name
    });
  }

  override toEmbed(): EmbedHelper {
    return new EmbedHelper()
      .setStyle('DataInfo')
      .setTitle('Showing Panel Data')
      .addFields(
        { name: 'ID', value: this.id, format: 'Block' },
        { name: 'Name', value: this.name, format: 'Block' },
        { name: 'Description', value: this.description, format: 'Block' },
        { name: 'Button Label', value: this.buttonLabel, format: 'Block' },
        { name: 'Button Emoji', value: this.buttonEmoji ?? '-', format: 'Block' },
        { name: 'Button Style', value: convertButtonStyleToHuman(this.buttonStyle), format: 'Block' },
        { name: 'Default Ticket Name', value: this.defaultTicketName, format: 'Block' },
        { name: 'Enabled', value: this.enabled, format: 'Boolean' }
      );
  }

  override toMessageData(): BaseMessageOptions {
    return {
      embeds: [this.toEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`panelModify:${this.id}:basic`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Edit Basic Options'),
          new ButtonBuilder()
            .setCustomId(`panelModify:${this.id}:supportTeam`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Edit Support Team Options'),
          new ButtonBuilder()
            .setCustomId(`panelModify:${this.id}:button`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Edit Button Options'),
          new ButtonBuilder()
            .setCustomId(`panelModify:${this.id}:opening`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Edit Opening Message Options')
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Preview Opening Message')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`panelPreviewOpeningMessage:${this.id}`),
          new ButtonBuilder()
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`refreshData:panel:${this.id}`),
          new ButtonBuilder()
            .setLabel('Export JSON')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`exportData:panel:${this.id}`)
        )
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: `${this.name} (${this.id})`, value: this.id };
  }

  override toJSON(): DatabasePanel {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      description: this.description,
      buttonLabel: this.buttonLabel,
      buttonEmoji: this.buttonEmoji,
      buttonStyle: this.buttonStyle,
      openingMessage: this.openingMessage,
      openingMessageContent: this.openingMessageContent,
      openingMessageTitle: this.openingMessageTitle,
      maxOpenTickets: this.maxOpenTickets,
      pinnedTicketPrefix: this.pinnedTicketPrefix,
      closedTicketPrefix: this.closedTicketPrefix,
      defaultTicketName: this.defaultTicketName,
      pingSupportTeamOnOpen: this.#pingSupportTeamOnOpen,
      supportTeamId: this.supportTeamId,
      enabled: this.#enabled
    };
  }
}

export default Panel;
