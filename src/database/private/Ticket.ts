import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import PolyHelperError from '../../private/error.ts';
import ms from 'ms';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
  type Message,
  MessageFlags,
  type TextThreadChannel,
  ThreadAutoArchiveDuration,
  User
} from 'discord.js';
import { CloseRequestButtons } from '../../discord/private/ComponentHelper.ts';
import { TicketActionEmbed, TicketEmbed } from '../../discord/private/EmbedHelper.ts';
import { getMention, getUserDisplayName, getUserId, isSupportMember } from '../../utils/discordUtils.ts';
import { getReason, replaceVariables } from '../../utils/stringUtils.ts';
import { toError } from '../../utils/miscUtils.ts';
import type CloseRequest from './CloseRequest.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type Panel from './Panel.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseCloseRequest, DatabaseTicket } from '../../types/database.ts';
import type { TicketAction } from '../../types/misc.ts';

class Ticket extends BaseParsedDatabaseItem<DatabaseTicket> {
  readonly id: DatabaseTicket['id'];
  readonly panelId: DatabaseTicket['panelId'];
  readonly threadId: DatabaseTicket['threadId'];
  readonly owner: DatabaseTicket['owner'];
  readonly pinMessageId: DatabaseTicket['pinMessageId'];
  readonly startingMessageId: DatabaseTicket['startingMessageId'];
  readonly openingTimestamp: DatabaseTicket['openingTimestamp'];
  readonly name: DatabaseTicket['name'];
  readonly #closed: DatabaseTicket['closed'];
  readonly lastMessageTimestamp: DatabaseTicket['lastMessageTimestamp'];
  readonly #lastMessageBySupport: DatabaseTicket['lastMessageBySupport'];
  readonly inactivityAlerts: DatabaseTicket['inactivityAlerts'];
  readonly lastAlertTimestamp: DatabaseTicket['lastAlertTimestamp'];
  constructor(
    data: DatabaseTicket,
    private readonly manager: DatabaseManager
  ) {
    super();
    this.id = data.id;
    this.panelId = data.panelId;
    this.threadId = data.threadId;
    this.owner = data.owner;
    this.pinMessageId = data.pinMessageId;
    this.startingMessageId = data.startingMessageId;
    this.openingTimestamp = data.openingTimestamp;
    this.name = data.name;
    this.#closed = data.closed;
    this.lastMessageTimestamp = data.lastMessageTimestamp;
    this.#lastMessageBySupport = data.lastMessageBySupport;
    this.inactivityAlerts = data.inactivityAlerts;
    this.lastAlertTimestamp = data.lastAlertTimestamp;
  }

  get pinned(): boolean {
    return this.pinMessageId !== null;
  }

  get closed(): boolean {
    return Boolean(this.#closed);
  }

  get lastMessageBySupport(): boolean {
    return Boolean(this.#lastMessageBySupport);
  }

  get nextInactivityAlertAt(): number | null {
    if (this.lastMessageTimestamp === null) return null;
    const delays = [ms('1d'), ms('3d'), ms('7d')];
    const delay = delays[Math.min(this.inactivityAlerts, delays.length - 1)] ?? ms('7d');
    return (this.lastAlertTimestamp ?? this.lastMessageTimestamp) + delay;
  }

  recordMessage(message: Message, bySupport: boolean): Ticket {
    return this.manager.updateTicketActivity(this.id, {
      lastMessageTimestamp: message.createdTimestamp,
      lastMessageBySupport: bySupport ? 1 : 0,
      inactivityAlerts: 0,
      lastAlertTimestamp: null
    });
  }

  async sendInactivityAlert(): Promise<Ticket> {
    const thread = await this.getThread();
    const since = `<t:${Math.floor((this.lastMessageTimestamp ?? Date.now()) / 1000)}:R>`;
    const supportRole = `<@&${this.manager.application.config.discord.roles.ticketPing}>`;
    const content = this.lastMessageBySupport
      ? `<@${this.owner}> Support is waiting on your reply. Last message was ${since}.`
      : `${supportRole} This ticket is waiting on a reply from support. Last message was ${since}.`;
    await thread.send({ content });
    return this.manager.updateTicketActivity(this.id, {
      lastMessageTimestamp: this.lastMessageTimestamp,
      lastMessageBySupport: this.#lastMessageBySupport,
      inactivityAlerts: this.inactivityAlerts + 1,
      lastAlertTimestamp: Date.now()
    });
  }

  get panel(): Panel {
    const panel = this.manager.getPanel(this.panelId);
    if (!panel) throw new PolyHelperError('Could not find the matching panel?');
    return panel;
  }

  async getDiscord(): Promise<GuildMember> {
    if (!this.manager.application.discord.isGuildReady()) {
      await this.manager.application.discord.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }

    return await this.manager.application.discord.guild.members.fetch(this.owner);
  }

  async getThread(): Promise<TextThreadChannel> {
    const channel = await this.manager.application.discord.getSupportChannel();
    const thread = await channel.threads.fetch(this.threadId);
    if (!thread) throw new PolyHelperError('Could not find the matching thread?');
    return thread;
  }

  async getLastMessageInTicket(): Promise<Message | null> {
    const thread = await this.getThread();
    if (thread.lastMessage !== null) return thread.lastMessage;
    const messages = await thread.messages.fetch({ limit: 1 });
    return messages.first() ?? null;
  }

  async refreshThread(): Promise<number | undefined> {
    const thread = await this.getThread();
    const threadArchiveDelay = ms('5m');
    if (thread.autoArchiveDuration === null) await thread.setAutoArchiveDuration(ThreadAutoArchiveDuration.OneWeek);

    const lastMessage = await this.getLastMessageInTicket();
    const lastActivity = lastMessage?.createdTimestamp ?? thread.createdTimestamp ?? Date.now();
    const autoArchiveAt = lastActivity + ms(`${thread.autoArchiveDuration ?? ThreadAutoArchiveDuration.OneWeek}m`);
    if (autoArchiveAt - Date.now() > threadArchiveDelay) return;
    if (thread.archived) await thread.setArchived(false);

    if (thread.editable && !thread.locked) {
      const nextDuration =
        thread.autoArchiveDuration === ThreadAutoArchiveDuration.OneWeek
          ? ThreadAutoArchiveDuration.ThreeDays
          : ThreadAutoArchiveDuration.OneWeek;

      try {
        await thread.setAutoArchiveDuration(
          nextDuration,
          "Keeping thread alive as it's a ticket and shouldn't get lost"
        );
        return nextDuration;
      } catch (error) {
        await this.manager.application.logError(toError(error), [
          { name: 'Ticket Id', value: this.id, format: 'Block' },
          { name: 'Operation', value: 'Set auto-archive duration; trying message fallback', format: 'Block' }
        ]);
      }
    }

    if (!thread.sendable || thread.archived || thread.locked) return;
    await thread.send({
      content: 'This ticket is still open. This message prevents the thread from being automatically archived.',
      flags: MessageFlags.SuppressNotifications
    });
    return thread.autoArchiveDuration ?? ThreadAutoArchiveDuration.OneWeek;
  }

  async getStartingMessage(): Promise<Message> {
    const thread = await this.getThread();
    const message = await thread.messages.fetch(this.startingMessageId).catch(() => null);
    if (!message) throw new PolyHelperError('Could not find the matching message?');
    return message;
  }

  async rename(options: {
    executor: TicketAction['executor'];
    name?: string;
    shouldReplaceVariables?: boolean;
    reason?: TicketAction['reason'];
    closed?: boolean;
    pinned?: boolean;
    silent?: boolean;
  }): Promise<Ticket> {
    let name = options.name ?? this.panel.defaultTicketName;
    const thread = await this.getThread();

    if (options.shouldReplaceVariables !== false) {
      const discord = await this.getDiscord();
      name = replaceVariables(name, {
        username: discord.user.username,
        id: discord.user.id,
        panelName: this.panel.name,
        cleanPanelName: this.panel.cleanName
      });
    }

    name = name
      .replaceAll(this.panel.fullClosedTicketPrefix, '')
      .replaceAll(this.panel.fullPinnedTicketPrefix, '')
      .trim();
    if (options.closed ?? this.closed) name = `${this.panel.fullClosedTicketPrefix} ${name}`;
    if (options.pinned ?? this.pinned) name = `${this.panel.fullPinnedTicketPrefix} ${name}`;

    await thread.setName(name, `Ticket renamed by ${getUserDisplayName(options.executor)}`);
    if (options.silent !== true) {
      await thread.send({
        embeds: [new TicketActionEmbed({ title: 'Renamed', executor: options.executor, reason: options.reason })]
      });
    }
    return this.manager.updateTicket({ ...this.toJSON(), name });
  }

  async mentionOwnerInThread(message: string = '') {
    const thread = await this.getThread();
    const user = await this.getDiscord();
    await thread.send({ content: `<@${user.user.id}>\n${message}`.trim() });
  }

  async close({ reason, executor }: TicketAction) {
    if (this.closed) throw new PolyHelperError('This ticket is already closed');
    if (this.pinned) throw new PolyHelperError('This ticket is pinned. Please unpin it before closing');
    const updated = await this.rename({
      executor,
      name: this.name,
      shouldReplaceVariables: false,
      closed: true,
      silent: true
    });
    const thread = await this.getThread();
    await thread.send({ embeds: [new TicketActionEmbed({ title: 'Closed', reason, executor })] });
    const closeRequest = this.manager.getCloseRequestByTicketId(this.id);
    if (closeRequest) await this.manager.deleteCloseRequest(closeRequest.id);
    await thread.setArchived(true, `Ticket closed by ${getUserDisplayName(executor)}`);
    this.manager.updateTicket({ ...updated.toJSON(), closed: 1 });
    this.manager.updateTicketActivity(this.id, {
      lastMessageTimestamp: null,
      lastMessageBySupport: 0,
      inactivityAlerts: 0,
      lastAlertTimestamp: null
    });
  }

  async open({ reason, executor }: TicketAction) {
    if (!this.closed) throw new PolyHelperError('This ticket is already open');
    const thread = await this.getThread();
    await thread.setArchived(false, `Ticket opened by ${getUserDisplayName(executor)}`);
    const updated = await this.rename({
      executor,
      name: this.name,
      shouldReplaceVariables: false,
      closed: false,
      silent: true
    });
    await thread.send({ embeds: [new TicketActionEmbed({ title: 'Opened', reason, executor })] });
    this.manager.updateTicket({ ...updated.toJSON(), closed: 0 });
  }

  async pin({ reason, executor }: TicketAction) {
    if (this.pinned) throw new PolyHelperError('This ticket is already pinned. Please unpin it to pin it');
    const thread = await this.getThread();
    const message = await thread.send({ embeds: [new TicketActionEmbed({ title: 'Pinned', reason, executor })] });
    await message.pin(`Ticket pinned by ${getUserDisplayName(executor)}`);
    return await this.manager
      .updateTicket({ ...this.toJSON(), pinMessageId: message.id })
      .rename({ executor, silent: true });
  }

  async getPinMessage(): Promise<Message | undefined> {
    if (!this.pinMessageId) return undefined;
    const thread = await this.getThread();
    const message = await thread.messages.fetch(this.pinMessageId).catch(() => undefined);
    return message;
  }

  async unpin({ reason, executor }: TicketAction) {
    if (!this.pinned) throw new PolyHelperError('This ticket isnt pinned. Please pin it to unpin it');
    const thread = await this.getThread();
    const pinMessage = await this.getPinMessage();
    if (!pinMessage) throw new PolyHelperError('Is this ticket pinned? I could not find the pinned message');
    await pinMessage.unpin(`Ticket unpinned by ${getUserDisplayName(executor)}`);
    await thread.send({ embeds: [new TicketActionEmbed({ title: 'Unpinned', reason, executor })] });
    return await this.manager.updateTicket({ ...this.toJSON(), pinMessageId: null }).rename({ executor, silent: true });
  }

  async addUser({ reason, executor, user }: TicketAction & { user: User }): Promise<Ticket> {
    const thread = await this.getThread();
    await thread.members.add(user);
    await thread.send({
      embeds: [
        new TicketActionEmbed({
          title: 'Added to ticket',
          fullTitleReplace: true,
          description: `${getMention(user)} was added to the ticket by ${getMention(executor)}`,
          reason,
          executor
        })
      ]
    });
    return this;
  }

  async removeUser({ reason, executor, user }: TicketAction & { user: GuildMember }): Promise<Ticket> {
    if (this.owner === user.id) throw new PolyHelperError('You cannot remove the ticket owner from the ticket');
    const isSupportTeam = await isSupportMember(user);
    if (isSupportTeam) throw new PolyHelperError('You cannot remove a support member from a ticket');
    const thread = await this.getThread();
    await thread.members.remove(user);
    await thread.send({
      embeds: [
        new TicketActionEmbed({
          title: 'Removed from ticket',
          fullTitleReplace: true,
          description: `${getMention(user)} was removed from the ticket by ${getMention(executor)}`,
          reason,
          executor
        })
      ]
    });
    return this;
  }

  get linkedCloseRequest(): CloseRequest | undefined {
    return this.manager.getCloseRequestByTicketId(this.id);
  }

  async closeRequest({ reason, executor, autoClose }: TicketAction & { autoClose: DatabaseCloseRequest['autoClose'] }) {
    if (this.closed) throw new PolyHelperError('This ticket is already closed');
    if (this.pinned) throw new PolyHelperError('This ticket is pinned. Please unpin it before closing');
    if (this.linkedCloseRequest) {
      const closeRequestMessage = await this.linkedCloseRequest.getMessage();
      throw new PolyHelperError(`There is already an active close request for this ticket. ${closeRequestMessage.url}`);
    }
    reason = getReason(reason);

    const embed = new TicketActionEmbed({
      title: 'Close Request',
      description: `${getMention(executor)} has requested to close this ticket`,
      reason,
      executor
    });
    if (autoClose !== null) {
      embed.addFields({ name: 'Automatically closes at', value: Math.floor(autoClose / 1000), format: 'Timestamp' });
    }
    embed.addFields({ name: '_ _', value: 'Please accept or deny using the buttons below.' });
    const id = crypto.randomUUID();
    const thread = await this.getThread();
    const user = await this.getDiscord();
    const message = await thread.send({
      content: `Hey <@${user.user.id}>`,
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(CloseRequestButtons(id))]
    });
    return this.manager.insertCloseRequest({
      id,
      ticketId: this.id,
      messageId: message.id,
      reason,
      closer: getUserId(executor),
      autoClose
    });
  }

  async getMessageData(): Promise<BaseMessageOptions> {
    const thread = await this.getThread();
    const startingMessage = await this.getStartingMessage();
    const pinMessage = await this.getPinMessage();
    return {
      embeds: [new TicketEmbed(this)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Go To Thread').setStyle(ButtonStyle.Link).setURL(thread.url),
          new ButtonBuilder().setLabel('Go To Top of Thread').setStyle(ButtonStyle.Link).setURL(startingMessage.url),
          new ButtonBuilder()
            .setLabel('Go To Pin Message')
            .setStyle(ButtonStyle.Link)
            .setURL(pinMessage?.url ?? 'https://amber.rip')
            .setDisabled(pinMessage === undefined)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel(this.closed ? 'Open' : 'Close')
            .setStyle(this.closed ? ButtonStyle.Secondary : ButtonStyle.Danger)
            .setCustomId(this.closed ? `reopenTicket:${this.id}` : `closeTicket:${this.id}`)
            .setDisabled(this.pinned),
          new ButtonBuilder()
            .setLabel(this.pinned ? 'Unpin' : 'Pin')
            .setStyle(this.pinned ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setCustomId(this.pinned ? `unpinTicket:${this.id}` : `pinTicket:${this.id}`),
          new ButtonBuilder()
            .setLabel('Refresh Embed')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`refreshTicketEmbed:${this.id}`),
          new ButtonBuilder()
            .setLabel('Join Thread')
            .setStyle(ButtonStyle.Success)
            .setCustomId(`joinThread:${this.threadId}`)
        )
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: `${this.name} - ${new Date(this.openingTimestamp).toISOString().split('T')[0]}`, value: this.id };
  }

  override toJSON(): DatabaseTicket {
    return {
      id: this.id,
      panelId: this.panelId,
      threadId: this.threadId,
      owner: this.owner,
      pinMessageId: this.pinMessageId,
      startingMessageId: this.startingMessageId,
      openingTimestamp: this.openingTimestamp,
      name: this.name,
      closed: this.#closed,
      lastMessageTimestamp: this.lastMessageTimestamp,
      lastMessageBySupport: this.#lastMessageBySupport,
      inactivityAlerts: this.inactivityAlerts,
      lastAlertTimestamp: this.lastAlertTimestamp
    };
  }
}

export default Ticket;
