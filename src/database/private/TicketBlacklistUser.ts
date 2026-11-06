import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { BaseMessageOptions, GuildMember, Message } from 'discord.js';
import type { DatabaseTicketBlacklistUser } from '../../types/database.ts';

class TicketBlacklistUser extends BaseParsedDatabaseItem<DatabaseTicketBlacklistUser> {
  readonly user: DatabaseTicketBlacklistUser['user'];
  readonly reason: DatabaseTicketBlacklistUser['reason'];
  readonly addedBy: DatabaseTicketBlacklistUser['addedBy'];
  readonly #active: DatabaseTicketBlacklistUser['active'];
  readonly removedReason: DatabaseTicketBlacklistUser['removedReason'];
  readonly removedBy: DatabaseTicketBlacklistUser['removedBy'];
  readonly logMessageId: DatabaseTicketBlacklistUser['logMessageId'];
  constructor(data: DatabaseTicketBlacklistUser, manager: DatabaseManager) {
    super(data, manager);
    this.user = data.user;
    this.reason = data.reason;
    this.addedBy = data.addedBy;
    this.#active = data.active;
    this.removedReason = data.removedReason;
    this.removedBy = data.removedBy;
    this.logMessageId = data.logMessageId;
  }

  get active(): boolean {
    return Boolean(this.#active);
  }

  async getUser(): Promise<GuildMember> {
    return await this.getGuildMember(this.user);
  }

  async getAddedByUser(): Promise<GuildMember> {
    return await this.getGuildMember(this.addedBy);
  }

  async getRemovedbyUser(): Promise<GuildMember | null> {
    if (this.removedBy === null) return null;
    return await this.getGuildMember(this.removedBy);
  }

  async getLogMessage(): Promise<Message | null> {
    if (this.logMessageId === null) return null;
    const channel = await this.manager.application.discord.getChannel('botLogs');
    return await channel.messages.fetch(this.logMessageId).catch(() => null);
  }

  override toEmbed(): EmbedHelper {
    const embed = super
      .toEmbed()
      .setTitle('Showing Ticket Blacklist User Data')
      .setColor(this.active ? 'Green' : 'Red')
      .addFields(
        { name: 'Active', value: this.active, format: 'Boolean' },
        { name: 'User', value: this.user, format: 'Discord User' },
        { name: 'Reason', value: this.reason, format: 'Block' },
        { name: 'Added By', value: this.addedBy, format: 'Discord User' },
        { name: '_ _', value: '_ _' },
        { name: 'Removed Reason', value: this.removedReason ?? '-', format: 'Block' }
      );
    if (this.removedBy) embed.addFields({ name: 'Removed By', value: this.removedBy, format: 'Discord User' });
    else embed.addFields({ name: 'Removed By', value: '-', format: 'Block' });
    return embed;
  }

  override toMessageData(): BaseMessageOptions {
    return { embeds: [this.toEmbed()], components: [this.getRefreshExportRow('ticketBlacklistUser')] };
  }

  override async toAutocompleteOption(): Promise<AutocompleteOption> {
    const discord = await this.getUser().catch(() => null);
    return { name: `@${discord?.user?.username ?? 'UNKNOWN'} (${this.id})`, value: this.id };
  }

  override toJSON(): DatabaseTicketBlacklistUser {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      user: this.user,
      reason: this.reason,
      addedBy: this.addedBy,
      active: this.#active,
      removedReason: this.removedReason,
      removedBy: this.removedBy,
      logMessageId: this.logMessageId
    };
  }
}

export default TicketBlacklistUser;
