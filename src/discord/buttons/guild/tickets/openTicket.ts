import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ButtonInteraction, ChannelType, MessageFlags, ThreadAutoArchiveDuration } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { getUserDisplayName } from '../../../../utils/discordUtils.ts';

class OpenTicketButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('openTicket')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel?');
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    if (!panel.enabled) throw new PolyHelperError('This ticket panel is currently disabled.');

    const tickets = this.discord.application.database.getTickets({
      panelId: panel.id,
      owner: interaction.user.id,
      closed: 0
    });
    if (tickets.length >= panel.maxOpenTickets) {
      for (const ticket of tickets) {
        const thread = await ticket.getThread();
        thread.members.add(interaction.user.id);
        await ticket.mentionOwnerInThread('Hey! This is your open ticket');
      }

      return await interaction.followUp({
        embeds: [
          new EmbedHelper()
            .setColor('Red')
            .setTitle('Maximum Tickets Reached')
            .setDescription(
              `You already have the maximum tickets allowed to be opened. I have helpfully pinged you in them\n${tickets
                .map((ticket) => `- <#${ticket.threadId}>`)
                .join('\n')}`
            )
        ]
      });
    }

    const channel = await this.discord.application.discord.getSupportChannel();
    const auditLogReason = `Ticket opened by ${getUserDisplayName(interaction.user)}`;
    const thread = await channel.threads.create({
      name: panel.parseTicketName({ user: interaction.user }),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread,
      invitable: true,
      reason: auditLogReason
    });
    await thread.members.add(interaction.user);
    const startingMessage = await thread.send(panel.getStartingMessageData(interaction.user));
    await startingMessage.pin(auditLogReason);

    if (panel.supportTeam) {
      const message = await thread.send({
        content: 'This message is used to add people to the thread without mentioning them. Please ignore it',
        flags: MessageFlags.SuppressNotifications
      });
      await message.edit({
        content: [
          message.content,
          `<@&${panel.supportTeam.supportRole}>`,
          `<@&${panel.supportTeam.ticketPingRole}>`
        ].join('\n')
      });
      await message.delete();

      if (panel.pingSupportTeamOnOpen) {
        await thread.send({ content: `<@&${panel.supportTeam.ticketPingRole}>` }).then((message) => message.delete());
      }
    }

    const ticket = this.discord.application.database.insertTicket({
      panelId: panel.id,
      threadId: thread.id,
      owner: interaction.user.id,
      pinMessageId: null,
      startingMessageId: startingMessage.id,
      openingTimestamp: Date.now(),
      name: thread.name,
      closed: 0,
      lastMessageTimestamp: null,
      lastMessageBySupport: 0,
      inactivityAlerts: 0,
      lastAlertTimestamp: null
    });
    await ticket.rename({ executor: interaction.user, silent: true });
    await interaction.followUp({
      embeds: [new EmbedHelper().setTitle('Ticket').setDescription(`Opened a ticket: <#${thread.id}>`)]
    });
  }
}

export default OpenTicketButton;
