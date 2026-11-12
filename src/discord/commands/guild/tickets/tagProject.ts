import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class TagProjectCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('tag-project')
    .setDescription('Tag a ticket to a project')
    .addStringOption((option) =>
      option.setName('project').setDescription('the project you want to tag this ticket with').setAutocomplete(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('The reason for tagging'))
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to tag this ticket...' });
    await this.getTicket(interaction).tagProject({
      executor: interaction.user,
      reason: this.getReason(interaction),
      taggedProjectId: interaction.options.getString('project') ?? null
    });
  }
}

export default TagProjectCommand;
