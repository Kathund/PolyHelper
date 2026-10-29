import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, InteractionPermission, type InteractionWithGuild } from '../../../../types/discord.ts';
import { SuccessEmbed } from '../../../private/EmbedHelper.ts';
import { hasRole } from '../../../../utils/discordUtils.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class ToggleTicketPingCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('toggle-ticket-ping')
    .setDescription('Toggle mentions for new support tickets.')
    .addStringOption((option) =>
      option.setName('support-team-id').setDescription('the support team id').setRequired(true).setAutocomplete(true)
    )
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const supportTeam = this.discord.application.database.getSupportTeam(
      interaction.options.getString('support-team-id', true)
    );
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');

    const has = await hasRole(interaction.member, supportTeam.ticketPingRole);
    if (has) await interaction.member.roles.remove(supportTeam.ticketPingRole);
    else await interaction.member.roles.add(supportTeam.ticketPingRole);

    await interaction.followUp({
      embeds: [
        new SuccessEmbed()
          .setDescription(
            has
              ? 'You will **no longer be mentioned** when new support tickets are opened.'
              : 'You will **now be mentioned** when new support tickets are opened.'
          )
          .addFields(
            { name: 'Support Team Name', value: supportTeam.name, format: 'Block' },
            { name: 'Support Team Id', value: supportTeam.id, format: 'Block' }
          )
      ]
    });
  }
}

export default ToggleTicketPingCommand;
