import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  type Message,
  PermissionFlagsBits
} from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import { OpenTicketButton } from '../../../private/ComponentHelper.ts';
import { isSupportMember } from '../../../../utils/discordUtils.ts';
import { toError } from '../../../../utils/miscUtils.ts';

class DebugTicketsCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('debug-tickets')
    .addSubcommand((option) => option.setName('refresh-panels-message').setDescription('refresh the panels message'))
    .addSubcommand((option) =>
      option
        .setName('sync-support-and-ticket-ping')
        .setDescription('sync the support role users with the ticket ping users')
        .addStringOption((option) =>
          option
            .setName('support-team-id')
            .setDescription('the support team id')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Admin);

  static async updatePanelsMessage(message: Message): Promise<Message> {
    const panels = message.client.discordManager.application.database.getPanels();
    return await message.edit({
      content: '',
      embeds: [
        new EmbedHelper()
          .setTitle(`${message.client.discordManager.guild?.name ?? 'UNKNOWN'} support tickets`)
          .setColor('Blue')
          .setFields(...panels.map((panel) => ({ name: `**${panel.title}**`, value: panel.description })))
      ],
      components:
        panels.length === 0
          ? []
          : [new ActionRowBuilder<ButtonBuilder>().addComponents(panels.map((panel) => OpenTicketButton(panel)))]
    });
  }

  async executeRefreshPanelsMessage(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const message = await this.discord.application.database.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
    await interaction.followUp({ content: `Message updated - ${message.url}` });
  }

  async executeSyncSupportAndTicketPing(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const supportTeam = this.discord.application.database.getSupportTeam(
      interaction.options.getString('support-team-id', true)
    );
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');

    const supportRole = await supportTeam.getSupportRole();
    const ticketPingRole = await supportTeam.getTicketPingRole();

    const removed: string[] = [];
    const added: string[] = [];
    const errors: string[] = [];

    const membersToRemove = (
      await Promise.all(
        [...ticketPingRole.members.values()].map(async (member) => ({
          member,
          isSupport: await isSupportMember(member)
        }))
      )
    )
      .filter(({ isSupport }) => !isSupport)
      .map(({ member }) => member);
    for (const member of membersToRemove) {
      try {
        await member.roles.remove(ticketPingRole);
        removed.push(member.id);
      } catch (error) {
        errors.push(`<@${member.id}>: ${toError(error).message}`);
      }
    }

    const membersToAdd = [...supportRole.members.values()].filter((member) => !ticketPingRole.members.has(member.id));
    for (const member of membersToAdd) {
      try {
        await member.roles.add(ticketPingRole);
        added.push(member.id);
      } catch (error) {
        errors.push(`<@${member.id}>: ${toError(error).message}`);
      }
    }

    await interaction.followUp({
      embeds: [
        new EmbedHelper()
          .setTitle('Support & Ticket Ping Role Sync')
          .setColor(errors.length > 0 ? 'Red' : 'Green')
          .setDescription('Synchronization completed.')
          .addFields(
            { name: `Added (${added.length})`, value: added.length ? added.map((id) => `<@${id}>`).join(' ') : 'None' },
            {
              name: `Removed (${removed.length})`,
              value: removed.length ? removed.map((id) => `<@${id}>`).join(' ') : 'None'
            },
            { name: `Errors (${errors.length})`, value: errors.length ? errors.join(' ') : 'None' }
          )
          .setTimestamp()
      ]
    });
  }

  override execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default DebugTicketsCommand;
