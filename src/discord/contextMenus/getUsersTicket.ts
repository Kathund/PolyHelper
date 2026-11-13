import DiscordContextMenu from '../private/interactions/contextMenus/DiscordContextMenu.ts';
import DiscordContextMenuMetadata from '../private/interactions/contextMenus/DiscordContextMenuMetadata.ts';
import { ApplicationCommandType, type ContextMenuCommandType, MessageFlags } from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild,
  type MessageAndUserContextMenuInteraction
} from '../../types/discord.ts';
import { TicketSearchResults } from '../private/ComponentHelper.ts';

class GetUsersTicketContextMenu extends DiscordContextMenu<MessageAndUserContextMenuInteraction> {
  private createMetadata(type: ContextMenuCommandType): DiscordContextMenuMetadata {
    return new DiscordContextMenuMetadata()
      .setName("Get User's Tickets")
      .setFlags(InteractionFlag.RequiresGuild)
      .setResponse(InteractionResponse.Ephemeral)
      .setPermission(InteractionPermission.Support)
      .setType(type);
  }

  override metadata = this.createMetadata(ApplicationCommandType.Message);
  override readonly variations: DiscordContextMenuMetadata[] = [this.createMetadata(ApplicationCommandType.User)];

  override async execute(interaction: InteractionWithGuild<MessageAndUserContextMenuInteraction>) {
    const ownerId =
      interaction.commandType === ApplicationCommandType.Message
        ? interaction.targetMessage.author.id
        : interaction.targetUser.id;
    const tickets = this.discord.application.database.getTickets({ owner: ownerId, limit: 25 });
    await interaction.followUp({
      components: TicketSearchResults(tickets, { owner: ownerId }),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
  }
}

export default GetUsersTicketContextMenu;
