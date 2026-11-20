import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../private/EmbedHelper.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  GuildMember
} from 'discord.js';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { hasRole } from '../../../utils/discordUtils.ts';
import type SupportTeam from '../../../database/private/SupportTeam.ts';

class ManageTicketNotificationsCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('manage-ticket-notifications')
    .setDescription('Manage your ticket notifications')
    .addStringOption((option) =>
      option.setName('support-team-id').setDescription('the support team id').setRequired(true).setAutocomplete(true)
    )
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral);

  static async getManageTicketNotificationsResponse(
    member: GuildMember,
    supportTeam: SupportTeam
  ): Promise<BaseMessageOptions> {
    const hasNewTicketPing = await hasRole(member, supportTeam.newTicketPingRole);
    const hasInactivityTicketPing = await hasRole(member, supportTeam.inactivityTicketPingRole);
    return {
      embeds: [
        new EmbedHelper()
          .setTitle('Managing Ticket Notifications')
          .setDescription(`**Support Team:** \`${supportTeam.name}\`\n**Support Team Id:** \`${supportTeam.id}\``)
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().setComponents(
          new ButtonBuilder()
            .setCustomId(`toggleTicketNotifications:${supportTeam.id}:new`)
            .setLabel(`${hasNewTicketPing ? 'Disable' : 'Enable'} New Ticket Alerts`)
            .setStyle(hasNewTicketPing ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`toggleTicketNotifications:${supportTeam.id}:inactivity`)
            .setLabel(`${hasInactivityTicketPing ? 'Disable' : 'Enable'} inactivity Ticket Alerts`)
            .setStyle(hasInactivityTicketPing ? ButtonStyle.Danger : ButtonStyle.Success)
        )
      ]
    };
  }

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const supportTeam = this.discord.application.database.getSupportTeam(
      interaction.options.getString('support-team-id', true)
    );
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');
    await interaction.followUp(
      await ManageTicketNotificationsCommand.getManageTicketNotificationsResponse(interaction.member, supportTeam)
    );
  }
}

export default ManageTicketNotificationsCommand;
