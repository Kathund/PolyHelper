import DiscordContextMenu from '../private/interactions/contextMenus/DiscordContextMenu.ts';
import DiscordContextMenuMetadata from '../private/interactions/contextMenus/DiscordContextMenuMetadata.ts';
import { ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { CreateIssueModal } from '../private/ComponentHelper.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../types/discord.ts';

class CreateIssueContextMenu extends DiscordContextMenu<MessageContextMenuCommandInteraction> {
  override metadata = new DiscordContextMenuMetadata()
    .setName('Create Isssue')
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.SuperContributor)
    .setResponse(InteractionResponse.None)
    .setType(ApplicationCommandType.Message);

  override async execute(interaction: InteractionWithGuild<MessageContextMenuCommandInteraction>) {
    await interaction.showModal(
      CreateIssueModal(interaction.targetMessage.messageSnapshots.at(0)?.content ?? interaction.targetMessage.content)
    );
  }
}

export default CreateIssueContextMenu;
