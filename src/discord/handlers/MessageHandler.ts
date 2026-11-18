import { type Message, MessageType } from 'discord.js';
import type DiscordManager from '../DiscordManager.ts';

class MessageHandler {
  constructor(private readonly discord: DiscordManager) {}

  async onMessage(message: Message) {
    if (message.type === MessageType.ThreadCreated) await this.onThreadCreated(message);
    if (message.channel.isThread() && !message.author.bot) this.onTicketMessage(message);
  }

  private async onThreadCreated(message: Message) {
    if (message.author.id !== message.client.user.id) return;
    if (message.channel.id !== this.discord.application.config.discord.channels.support) return;
    await message.delete().catch();
  }

  private onTicketMessage(message: Message) {
    const ticket = this.discord.application.database.getTicketByThreadId(message.channelId);
    if (!ticket) return;
    if (ticket.closed) return;
    const hasMessageFromOwner = ticket.hasMessageFromOwner || message.author.id === ticket.owner;
    this.discord.application.database.updateTicket({
      ...ticket.toJSON(),
      lastMessageTimestamp: message.createdTimestamp,
      inactivityNoticeId: null,
      hasMessageFromOwner: hasMessageFromOwner ? 1 : 0
    });
  }
}

export default MessageHandler;
