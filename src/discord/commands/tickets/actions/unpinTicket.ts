import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class UnpinTicketCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('unpinticket')
    .setDescription('Unpin a ticket')
    .addStringOption((option) => option.setName('reason').setDescription('The reason for pinning the ticket'))
    .setCleanErrorTitle('unpin this ticket')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to unpin this ticket...' });
    await this.getTicket(interaction).unpin({ reason: this.getReason(interaction), executor: interaction.user });
  }
}

export default UnpinTicketCommand;
