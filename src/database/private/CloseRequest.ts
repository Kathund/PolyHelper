import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import PolyHelperError from '../../private/error.ts';
import { ActionRowBuilder, type ButtonBuilder, GuildMember, type Message } from 'discord.js';
import { CloseRequestButtons } from '../../discord/private/ComponentHelper.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type Ticket from './Ticket.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseCloseRequest } from '../../types/database.ts';

class CloseRequest extends BaseParsedDatabaseItem<DatabaseCloseRequest> {
  readonly id: DatabaseCloseRequest['id'];
  readonly ticketId: DatabaseCloseRequest['ticketId'];
  readonly messageId: DatabaseCloseRequest['messageId'];
  readonly reason: DatabaseCloseRequest['reason'];
  readonly closer: DatabaseCloseRequest['closer'];
  readonly autoClose: DatabaseCloseRequest['autoClose'];
  constructor(
    data: DatabaseCloseRequest,
    private readonly manager: DatabaseManager
  ) {
    super();
    this.id = data.id;
    this.ticketId = data.ticketId;
    this.messageId = data.messageId;
    this.reason = data.reason;
    this.closer = data.closer;
    this.autoClose = data.autoClose;
  }

  get ticket(): Ticket {
    const ticket = this.manager.getTicket(this.ticketId);
    if (!ticket) throw new PolyHelperError('Could not find the matching ticket?');
    return ticket;
  }

  async getMessage(): Promise<Message> {
    const thread = await this.ticket.getThread();
    const message = await thread.messages.fetch(this.messageId).catch(() => null);
    if (!message) throw new PolyHelperError('Could not find the matching message?');
    return message;
  }

  async updateMessageButtons(disabled: boolean = false): Promise<Message> {
    const message = await this.getMessage();
    return await message.edit({
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(CloseRequestButtons(this.id, disabled))]
    });
  }

  async getDiscord(): Promise<GuildMember> {
    if (!this.manager.application.discord.isGuildReady()) {
      await this.manager.application.discord.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }

    return await this.manager.application.discord.guild.members.fetch(this.closer);
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: this.id, value: this.id };
  }

  override toJSON(): DatabaseCloseRequest {
    return {
      id: this.id,
      ticketId: this.ticketId,
      messageId: this.messageId,
      reason: this.reason,
      closer: this.closer,
      autoClose: this.autoClose
    };
  }
}

export default CloseRequest;
