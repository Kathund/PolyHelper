import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import ManageTicketNotificationsCommand from '../../commands/tickets/manageTicketNotifications.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { hasRole } from '../../../utils/discordUtils.ts';
import type { ButtonInteraction } from 'discord.js';

class ToggleTicketNotificationsButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('toggleTicketNotifications')
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Update);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id, type] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this support team?');
    const supportTeam = this.discord.application.database.getSupportTeam(id);
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');
    if (type === 'new') {
      const hasNewTicketPing = await hasRole(interaction.member, supportTeam.newTicketPingRole);
      if (hasNewTicketPing) await interaction.member.roles.remove(supportTeam.newTicketPingRole);
      else await interaction.member.roles.add(supportTeam.newTicketPingRole);
    } else if (type === 'inactivity') {
      const hasInactivityTicketPing = await hasRole(interaction.member, supportTeam.inactivityTicketPingRole);
      if (hasInactivityTicketPing) await interaction.member.roles.remove(supportTeam.inactivityTicketPingRole);
      else await interaction.member.roles.add(supportTeam.inactivityTicketPingRole);
    } else {
      throw new PolyHelperError('Invalid Toggle Ticket Notifications Type? Please use either new or inactivity');
    }

    await interaction.editReply(
      await ManageTicketNotificationsCommand.getManageTicketNotificationsResponse(interaction.member, supportTeam)
    );
  }
}

export default ToggleTicketNotificationsButton;
