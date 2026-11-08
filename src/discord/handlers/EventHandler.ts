import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type GuildAuditLogsEntry,
  GuildMember,
  type PartialGuildMember
} from 'discord.js';
import type DiscordManager from '../DiscordManager.ts';
import type Ticket from '../../database/private/Ticket.ts';
import type { TicketAction } from '../../types/misc.ts';

class EventHandler {
  constructor(private readonly discord: DiscordManager) {}

  async onReady(client: Client<true>) {
    console.discord(`Logged in as ${client.user.username} (${client.user.id})!`);
    await this.discord.loadGuild();
  }

  async onGuildAuditLogEntryCreate(entry: GuildAuditLogsEntry) {
    if (entry.action !== AuditLogEvent.ThreadUpdate) return;
    if (!entry.targetId || !entry.executor) return;
    if (entry.executor.id === entry.executor.client.user.id) return;
    const ticket = this.discord.application.database.getTicketByThreadId(entry.targetId);
    if (!ticket) return;
    const action: TicketAction = { executor: entry.executor };
    for (const change of entry.changes) {
      if (change.key === 'name') await this.onTicketRename(ticket, entry, action);
      if (change.key === 'archived' && change.new === true) await this.onTicketArchive(ticket, action);
      if (change.key === 'archived' && change.new === false) await this.onTicketUnarchive(ticket, action);
    }
  }

  private async onTicketRename(ticket: Ticket, entry: GuildAuditLogsEntry, action: TicketAction) {
    await ticket.rename({
      executor: action.executor,
      name: entry.changes.find((change) => change.key === 'name')?.new
    });
  }

  private async onTicketArchive(ticket: Ticket, action: TicketAction) {
    if (ticket.closed) return;
    await ticket.close(action);
  }

  private async onTicketUnarchive(ticket: Ticket, action: TicketAction) {
    if (!ticket.closed) return;
    await ticket.open(action);
  }

  async onGuildMemberAdd(member: GuildMember | PartialGuildMember) {
    const tickets = this.discord.application.database.getTickets({ owner: member.user.id, closed: false });
    for (const ticket of tickets) await ticket.addUser({ user: member.user, executor: member.user, silent: true });
  }

  async onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
    const tickets = this.discord.application.database.getTickets({ owner: member.user.id, closed: false });
    for (const ticket of tickets) {
      const thread = await ticket.getThread();
      await thread.send({
        content: 'Ticket owner left, please chase them down',
        components: [
          new ActionRowBuilder<ButtonBuilder>().setComponents(
            new ButtonBuilder()
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
              .setCustomId(`closeTicket:${ticket.id}`)
          )
        ]
      });
    }
  }
}

export default EventHandler;
