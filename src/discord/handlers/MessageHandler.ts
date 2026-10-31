import EmbedHelper, { ErrorEmbed } from '../private/EmbedHelper.ts';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Message, MessageFlags, MessageType } from 'discord.js';
import { cleanString, findLogURL, getNewLog, mclogsLogo, verbalizeCrash } from '../../utils/mclogsAPIUtils.ts';
import { formatSize } from '../../utils/stringUtils.ts';
import { toError } from '../../utils/miscUtils.ts';
import type DiscordManager from '../DiscordManager.ts';

class MessageHandler {
  constructor(private readonly discord: DiscordManager) {}

  async onMessage(message: Message) {
    if (message.type === MessageType.ThreadCreated) await this.onThreadCreated(message);
    if (message.channel.isThread() && !message.author.bot) this.onTicketMessage(message);
    if (
      this.discord.application.config.discord.minecraftLogCleaner &&
      !message.flags.has(MessageFlags.SuppressNotifications) &&
      !message.author.bot &&
      !['poly ignore', 'sky ignore'].some((phrase) => message.content.toLowerCase().includes(phrase))
    ) {
      await this.onLogMessage(message);
    }
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
    this.discord.application.database.updateTicket({
      ...ticket.toJSON(),
      lastMessageTimestamp: message.createdTimestamp,
      inactivityNoticeId: null
    });
  }

  private async onLogMessage(message: Message) {
    try {
      if (!message.channel.isSendable()) return;
      const logURL = findLogURL(message);
      if (!logURL) return;

      await message.channel.sendTyping();

      const uploadedLog = await getNewLog(logURL, [
        { key: 'uploader', value: message.author.tag, label: 'Uploader' },
        { key: 'uploader_id', value: message.author.id, visible: false }
      ]);
      if (!uploadedLog.success) {
        return await message.channel.send({ embeds: [new ErrorEmbed().setDescription(uploadedLog.error)] });
      }

      await message.delete().catch(() => null);
      const embeds: EmbedHelper[] = [
        new EmbedHelper()
          .setTitle(uploadedLog.content.insights.title)
          .setURL(uploadedLog.url)
          .setColor('Gray')
          .setThumbnail(mclogsLogo)
          .setFields(
            ...uploadedLog.content.insights.analysis.information.map(({ label, value }) => ({
              name: label,
              value,
              inline: true
            }))
          )
          .setFooter({ text: `${formatSize(uploadedLog.size)} / ${uploadedLog.lines} lines` })
      ];

      const verb = await verbalizeCrash(uploadedLog.content.raw);
      if (verb.length > 0) {
        embeds.push(
          new EmbedHelper()
            .setTitle('Bot Analysis')
            .setColor('Green')
            .setThumbnail(message.client.user.avatarURL())
            .setFields(...verb)
        );
      }

      const lines: string[] = [`<@${message.author.id}> uploaded a ${uploadedLog.content.insights.type}`];
      const userMessage = cleanString(message.content);
      if (userMessage.length > 0) {
        lines.push(
          userMessage
            .split(/\r?\n/)
            .map((line) => `> ${line || ' '}`)
            .join('\n')
            .trim()
        );
      }

      await message.channel.send({
        content: lines.join('\n'),
        embeds,
        components: [
          new ActionRowBuilder<ButtonBuilder>().setComponents(
            new ButtonBuilder().setURL(uploadedLog.url).setLabel('Open on mclo.gs').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setURL(uploadedLog.raw).setLabel('Raw Log').setStyle(ButtonStyle.Link)
          )
        ],
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      this.discord.handleError(toError(error));
      if (message.channel.isSendable()) {
        await message.channel
          .send({
            embeds: [
              new ErrorEmbed()
                .setAuthor({ name: 'Something went wrong while parsing this mclog' })
                .setDescription('This error has been reported to the devs. Please try again later.')
            ]
          })
          .catch((e) => this.discord.handleError(toError(e)));
      }
    }
  }
}

export default MessageHandler;
