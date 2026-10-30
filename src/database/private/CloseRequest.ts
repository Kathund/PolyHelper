import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  type Message
} from 'discord.js';
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

  override toEmbed(): EmbedHelper {
    const embed = new EmbedHelper()
      .setStyle('DataInfo')
      .setTitle('Showing Close Request Data')
      .addFields(
        { name: 'ID', value: this.id, format: 'Block' },
        { name: 'Ticket Id', value: this.ticketId, format: 'Block' },
        { name: 'Message Id', value: this.messageId, format: 'Block' },
        { name: 'Reason', value: this.reason, format: 'Block' },
        { name: 'Closer', value: this.closer, format: 'Discord User' }
      );

    if (this.autoClose !== null) embed.addFields({ name: 'Auto Close', value: this.autoClose, format: 'Timestamp' });
    else embed.addFields({ name: 'Auto Close', value: '-' });

    return embed;
  }

  override toMessageData(): BaseMessageOptions {
    return {
      embeds: [this.toEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`refreshData:closeRequest:${this.id}`),
          new ButtonBuilder()
            .setLabel('Export JSON')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`exportData:ticket:${this.id}`)
        )
      ]
    };
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
