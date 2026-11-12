import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import EmbedHelper, { TicketActionEmbed } from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import ms from 'ms';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  DiscordAPIError,
  type GuildMember,
  type Message,
  MessageFlags,
  type TextThreadChannel,
  ThreadAutoArchiveDuration,
  User
} from 'discord.js';
import { CloseRequestButtons } from '../../discord/private/ComponentHelper.ts';
import { getId, getMention, getUserDisplayName, isSupportMember } from '../../utils/discordUtils.ts';
import { getReason, replaceVariables } from '../../utils/stringUtils.ts';
import { toError } from '../../utils/miscUtils.ts';
import type CloseRequest from './CloseRequest.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type Panel from './Panel.ts';
import type Project from './Project.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseCloseRequest, DatabaseTicket } from '../../types/database.ts';
import type { TicketAction } from '../../types/misc.ts';

class Ticket extends BaseParsedDatabaseItem<DatabaseTicket> {
  readonly panelId: DatabaseTicket['panelId'];
  readonly threadId: DatabaseTicket['threadId'];
  readonly owner: DatabaseTicket['owner'];
  readonly pinMessageId: DatabaseTicket['pinMessageId'];
  readonly startingMessageId: DatabaseTicket['startingMessageId'];
  readonly openingTimestamp: DatabaseTicket['openingTimestamp'];
  readonly lastMessageTimestamp: DatabaseTicket['lastMessageTimestamp'];
  readonly inactivityNoticeId: DatabaseTicket['inactivityNoticeId'];
  readonly #inactivitySilenced: DatabaseTicket['inactivitySilenced'];
  readonly name: DatabaseTicket['name'];
  readonly taggedProjectId: DatabaseTicket['taggedProjectId'];
  readonly closedBy: DatabaseTicket['closedBy'];
  readonly closedReason: DatabaseTicket['closedReason'];
  readonly ticketLogsMesageId: DatabaseTicket['ticketLogsMesageId'];
  readonly #closed: DatabaseTicket['closed'];
  constructor(data: DatabaseTicket, manager: DatabaseManager) {
    super(data, manager);
    this.panelId = data.panelId;
    this.threadId = data.threadId;
    this.owner = data.owner;
    this.pinMessageId = data.pinMessageId;
    this.startingMessageId = data.startingMessageId;
    this.openingTimestamp = data.openingTimestamp;
    this.lastMessageTimestamp = data.lastMessageTimestamp;
    this.inactivityNoticeId = data.inactivityNoticeId;
    this.#inactivitySilenced = data.inactivitySilenced;
    this.name = data.name;
    this.taggedProjectId = data.taggedProjectId;
    this.closedBy = data.closedBy;
    this.closedReason = data.closedReason;
    this.ticketLogsMesageId = data.ticketLogsMesageId;
    this.#closed = data.closed;
  }

  get pinned(): boolean {
    return this.pinMessageId !== null;
  }

  get inactivitySilenced(): boolean {
    return Boolean(this.#inactivitySilenced);
  }

  get closed(): boolean {
    return Boolean(this.#closed);
  }

  get panel(): Panel {
    const panel = this.manager.getPanel(this.panelId);
    if (!panel) throw new PolyHelperError('Could not find the matching panel?');
    return panel;
  }

  get taggedProject(): Project | null {
    if (!this.taggedProjectId) return null;
    return this.manager.getProject(this.taggedProjectId) ?? null;
  }

  async getOwnerDiscord(): Promise<GuildMember> {
    try {
      return await this.getGuildMember(this.owner);
    } catch (error) {
      if (!(error instanceof DiscordAPIError) || error.code !== 10007) throw error;
      const thread = await this.getThread();
      await thread.send({
        content: 'Ticket owner left, please chase them down.',
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
              .setCustomId(`closeTicket:${this.id}:User_Left`)
          )
        ]
      });
      throw new PolyHelperError('Ticket owner left, please chase them down.');
    }
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

  async getInactivityMessage(): Promise<Message | null> {
    if (!this.inactivityNoticeId) return null;
    const thread = await this.getThread();
    return await thread.messages.fetch(this.inactivityNoticeId).catch(() => null);
  }

  async sendInactivityNotice(): Promise<Ticket> {
    const thread = await this.getThread();
    if (!thread.sendable || thread.locked) return this;
    if (thread.archived) await thread.setArchived(false, 'Sending a ticket inactivity reminder');

    const supportRole = this.panel.supportTeam?.ticketPingRole ?? this.manager.application.config.discord.roles.support;
    const message = await thread.send({
      content: [
        `This ticket appears to be inactive. <@&${supportRole}> <@${this.owner}>`,
        this.lastMessageTimestamp === null
          ? 'No messages have been sent yet.'
          : `Last message was <t:${Math.floor(this.lastMessageTimestamp / 1000)}:R>`,
        'Is this problem still occurring? Are there any updates we should know about?'
      ].join('\n'),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Silence').setStyle(ButtonStyle.Secondary).setCustomId('silenceTicketInactivity')
        )
      ]
    });
    return this.manager.updateTicket({ ...this.toJSON(), inactivityNoticeId: message.id });
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
      const discord = await this.getOwnerDiscord();
      if (options.name === undefined && options.shouldReplaceVariables) {
        name = this.panel.parseTicketName({ user: discord.user, shouldReplaceVariables: true });
      }
      name = replaceVariables(name, {
        username: discord.user.username,
        id: discord.user.id,
        panelName: this.panel.name,
        cleanPanelName: this.panel.name
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
    const user = await this.getOwnerDiscord();
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
    this.manager.updateTicket({
      ...(await updated.deleteTicketLogMessage()).toJSON(),
      closed: 1,
      closedBy: executor.id,
      closedReason: getReason(reason)
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
    this.manager.updateTicket({ ...updated.toJSON(), closed: 0, closedBy: null, closedReason: null });
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

  async addUser({ reason, executor, user, silent }: TicketAction & { user: User; silent?: boolean }): Promise<Ticket> {
    if (this.closed) throw new PolyHelperError('You cannot add a user to a closed ticket');
    const thread = await this.getThread();
    await thread.members.add(user);
    if (silent !== true) {
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
    }
    return this;
  }

  async removeUser({ reason, executor, user }: TicketAction & { user: GuildMember }): Promise<Ticket> {
    if (this.closed) throw new PolyHelperError('You cannot remove a user to a closed ticket');
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
      throw new PolyHelperError(`There is already an active close request for this this. ${closeRequestMessage.url}`);
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
    const user = await this.getOwnerDiscord().catch(() => null);
    if (user === null) throw new PolyHelperError('Could not fetch the ticket owner. They most likely have left');
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
      closer: getId(executor),
      autoClose
    });
  }

  async tagProject({
    reason,
    executor,
    taggedProjectId
  }: TicketAction & { taggedProjectId: DatabaseTicket['taggedProjectId'] }) {
    const updated = this.manager.updateTicket({ ...this.toJSON(), taggedProjectId });
    const thread = await this.getThread();
    const embed = new TicketActionEmbed({ title: 'Tagged', reason, executor });
    embed.setFields({ name: 'Project', value: updated.taggedProject?.name ?? 'None' }, ...embed.fields);
    await thread.send({ embeds: [embed] });
    return updated;
  }

  static getTicketLogMessageContent({ user, thread }: { user: User; thread: TextThreadChannel }) {
    return `Ticket opened by <@${user.id}> (\`${user.id}\`) - ${thread.url}`;
  }

  async getTicketLogMessage(): Promise<Message | null> {
    if (this.ticketLogsMesageId === null) return null;
    const logs = await this.manager.application.discord.getChannel('ticketLogs');
    const message = await logs.messages.fetch(this.ticketLogsMesageId).catch(() => null);
    if (!message) throw new PolyHelperError('Could not find the matching ticket log message?');
    return message;
  }

  async deleteTicketLogMessage(): Promise<Ticket> {
    const ticketLogMesasge = await this.getTicketLogMessage();
    if (ticketLogMesasge) await ticketLogMesasge.delete();
    return this.manager.updateTicket({ ...this.toJSON(), ticketLogsMesageId: null });
  }

  async transfer({ reason, executor, user, silent }: TicketAction & { user: User; silent?: boolean }) {
    const updated = this.manager.updateTicket({ ...this.toJSON(), owner: user.id });
    const thread = await this.getThread();
    if (silent !== true) {
      await thread.send({
        embeds: [
          new TicketActionEmbed({
            title: 'Transfered',
            description: `Ticket transfered from <@${this.owner}> to <@${user.id}> by ${getMention(executor)}`,
            reason,
            executor
          })
        ]
      });
    }
    await this.addUser({ reason, executor, user, silent: true });
    const logMessage = await this.getTicketLogMessage();
    if (logMessage) await logMessage.edit({ content: Ticket.getTicketLogMessageContent({ user, thread }) });
    return await updated.rename({ executor, silent: true });
  }

  override toEmbed(): EmbedHelper {
    return super
      .toEmbed()
      .setTitle('Showing Ticket Data')
      .addFields(
        { name: 'Panel ID', value: this.panelId, format: 'Block' },
        { name: 'Thread', value: `<#${this.threadId}>` },
        { name: 'Opend', value: Math.floor(this.openingTimestamp / 1000), format: 'Timestamp' },
        { name: 'Owner', value: this.owner, format: 'Discord User' },
        { name: 'Tagged Project', value: this.taggedProject?.name ?? 'None', format: 'Block' },
        { name: 'Is Closed', value: this.closed, format: 'Boolean', inline: true },
        { name: 'Is Pinned', value: this.pinned, format: 'Boolean', inline: true },
        { name: 'Is Silenced', value: this.inactivitySilenced, format: 'Boolean', inline: true }
      );
  }

  override async toMessageData(): Promise<BaseMessageOptions> {
    const thread = await this.getThread();
    const startingMessage = await this.getStartingMessage();
    const pinMessage = await this.getPinMessage();
    return {
      embeds: [this.toEmbed()],
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
            .setLabel('Join Thread')
            .setStyle(ButtonStyle.Success)
            .setCustomId(`joinThread:${this.threadId}`)
        ),
        this.getRefreshExportRow('ticket')
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: `${this.name} - ${new Date(this.openingTimestamp).toISOString().split('T')[0]}`, value: this.id };
  }

  override toJSON(): DatabaseTicket {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      panelId: this.panelId,
      threadId: this.threadId,
      owner: this.owner,
      pinMessageId: this.pinMessageId,
      startingMessageId: this.startingMessageId,
      openingTimestamp: this.openingTimestamp,
      lastMessageTimestamp: this.lastMessageTimestamp,
      inactivityNoticeId: this.inactivityNoticeId,
      inactivitySilenced: this.#inactivitySilenced,
      name: this.name,
      taggedProjectId: this.taggedProjectId,
      closedBy: this.closedBy,
      closedReason: this.closedReason,
      ticketLogsMesageId: this.ticketLogsMesageId,
      closed: this.#closed
    };
  }
}

export default Ticket;
