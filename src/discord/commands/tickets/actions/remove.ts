import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { isGuildMember } from '../../../../utils/discordUtils.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class RemoveCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('remove')
    .setDescription('Remove a user from a ticket')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user you want to remove from the ticket').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('The reason for removing a user to this ticket')
    )
    .setCleanErrorTitle('remove this user to the ticket')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to remove a user to this ticket...' });
    const user = interaction.options.getMember('user');
    if (!isGuildMember(user)) throw new PolyHelperError('Could not find that user');
    await this.getTicket(interaction).removeUser({
      executor: interaction.user,
      reason: this.getReason(interaction),
      user
    });
  }
}

export default RemoveCommand;
