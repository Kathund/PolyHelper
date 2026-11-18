import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class AddCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('add')
    .setDescription('Add a user to a ticket')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user you want to add to the ticket').setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('The reason for adding a user to this ticket'))
    .setCleanErrorTitle('add this user to the ticket')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to add a user to this ticket...' });
    await this.getTicket(interaction).addUser({
      executor: interaction.user,
      reason: this.getReason(interaction),
      user: interaction.options.getUser('user', true)
    });
  }
}

export default AddCommand;
