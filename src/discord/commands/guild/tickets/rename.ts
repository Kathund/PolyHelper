import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class RenameCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('rename')
    .setDescription('Rename a ticket')
    .addStringOption((option) =>
      option.setName('name').setDescription('Supported variables - {username} {id} {panelName}')
    )
    .setCleanErrorTitle('renaming this ticket')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to rename this ticket.' });
    await this.getTicket(interaction).rename({
      executor: interaction.user,
      name: interaction.options.getString('name') ?? undefined
    });
  }
}

export default RenameCommand;
