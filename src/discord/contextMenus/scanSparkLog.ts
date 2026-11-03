import DiscordContextMenu from '../private/interactions/contextMenus/DiscordContextMenu.ts';
import DiscordContextMenuMetadata from '../private/interactions/contextMenus/DiscordContextMenuMetadata.ts';
import PolyHelperError from '../../private/error.ts';
import { ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../types/discord.ts';
import { findSparkId } from '../../utils/sparkUtils.ts';

class ScanSparkLogContextMenu extends DiscordContextMenu<MessageContextMenuCommandInteraction> {
  override metadata = new DiscordContextMenuMetadata()
    .setName('Scan Spark Log')
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral)
    .setType(ApplicationCommandType.Message);

  override async execute(interaction: InteractionWithGuild<MessageContextMenuCommandInteraction>) {
    const sparkId = findSparkId(
      interaction.targetMessage.messageSnapshots.at(0)?.content ?? interaction.targetMessage.content
    );
    if (!sparkId) throw new PolyHelperError("That isn't a spark.lucko.me link");
    await this.discord.application.spark.scanSparkLog({
      mode: 'analyze',
      sparkId,
      baselineId: null,
      supportNotes: null,
      interaction
    });
  }
}

export default ScanSparkLogContextMenu;
