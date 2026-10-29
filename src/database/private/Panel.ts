import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import { replaceVariables } from '../../utils/stringUtils.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type SupportTeam from './SupportTeam.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { BaseMessageOptions, User } from 'discord.js';
import type { DatabasePanel, TicketSearchFilters } from '../../types/database.ts';

class Panel extends BaseParsedDatabaseItem<DatabasePanel> {
  readonly id: DatabasePanel['id'];
  readonly name: DatabasePanel['name'];
  readonly cleanName: DatabasePanel['cleanName'];
  readonly title: DatabasePanel['title'];
  readonly description: DatabasePanel['description'];
  readonly buttonLabel: DatabasePanel['buttonLabel'];
  readonly buttonEmoji: DatabasePanel['buttonEmoji'];
  readonly openingMessage: DatabasePanel['openingMessage'];
  readonly maxOpenTickets: DatabasePanel['maxOpenTickets'];
  readonly pinnedTicketPrefix: DatabasePanel['pinnedTicketPrefix'];
  readonly closedTicketPrefix: DatabasePanel['closedTicketPrefix'];
  readonly defaultTicketName: DatabasePanel['defaultTicketName'];
  readonly #pingSupportRoleOnOpen: DatabasePanel['pingSupportRoleOnOpen'];
  readonly supportTeamId: DatabasePanel['supportTeamId'];
  readonly #enabled: DatabasePanel['enabled'];
  constructor(
    data: DatabasePanel,
    private readonly manager: DatabaseManager
  ) {
    super();
    this.id = data.id;
    this.name = data.name;
    this.cleanName = data.cleanName;
    this.title = data.title;
    this.description = data.description;
    this.buttonLabel = data.buttonLabel;
    this.buttonEmoji = data.buttonEmoji;
    this.openingMessage = data.openingMessage;
    this.maxOpenTickets = data.maxOpenTickets;
    this.pinnedTicketPrefix = data.pinnedTicketPrefix;
    this.closedTicketPrefix = data.closedTicketPrefix;
    this.defaultTicketName = data.defaultTicketName;
    this.#pingSupportRoleOnOpen = data.pingSupportRoleOnOpen;
    this.supportTeamId = data.supportTeamId;
    this.#enabled = data.enabled;
  }

  get fullClosedTicketPrefix(): string {
    return `[${this.closedTicketPrefix}]`;
  }

  get fullPinnedTicketPrefix(): string {
    return `[${this.pinnedTicketPrefix}]`;
  }

  get pingSupportRoleOnOpen(): boolean {
    return Boolean(this.#pingSupportRoleOnOpen);
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
    return {
      content: `<@${user.id}>`,
      embeds: [
        new EmbedHelper()
          .setColor('Green')
          .setTitle(this.cleanName)
          .setDescription(
            replaceVariables(this.openingMessage, { mention: `<@${user.id}>`, username: user.username, id: user.id })
          )
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

  override toEmbed(): EmbedHelper {
    return new EmbedHelper()
      .setStyle('DataInfo')
      .setTitle('Showing Panel Data')
      .addFields(
        { name: 'ID', value: this.id, format: 'Block' },
        { name: 'Description', value: this.description, format: 'Block' },
        { name: 'Enabled', value: this.enabled, format: 'Boolean' }
      );
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: this.id, value: this.id };
  }

  override toJSON(): DatabasePanel {
    return {
      id: this.id,
      name: this.name,
      cleanName: this.cleanName,
      title: this.title,
      description: this.description,
      buttonLabel: this.buttonLabel,
      buttonEmoji: this.buttonEmoji,
      openingMessage: this.openingMessage,
      maxOpenTickets: this.maxOpenTickets,
      pinnedTicketPrefix: this.pinnedTicketPrefix,
      closedTicketPrefix: this.closedTicketPrefix,
      defaultTicketName: this.defaultTicketName,
      pingSupportRoleOnOpen: this.#pingSupportRoleOnOpen,
      supportTeamId: this.supportTeamId,
      enabled: this.#enabled
    };
  }
}

export default Panel;
