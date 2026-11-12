import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class TransferCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('transfer')
    .setDescription('Transfer ticket ownership to a different user')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user you want to transfer this ticket to').setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('The reason transfering ticket ownership'))
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to transfer this ticket...' });
    await this.getTicket(interaction).transfer({
      executor: interaction.user,
      reason: this.getReason(interaction),
      user: interaction.options.getUser('user', true)
    });
  }
}

export default TransferCommand;
