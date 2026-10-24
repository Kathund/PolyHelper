import DiscordContextMenu from '../private/interactions/contextMenus/DiscordContextMenu.ts';
import DiscordContextMenuMetadata from '../private/interactions/contextMenus/DiscordContextMenuMetadata.ts';
import EmbedHelper from '../private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import { ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../types/discord.ts';
import { findSparkId, getSparkURL } from '../../utils/sparkUtils.ts';

class ScanSparkLogContextMenu extends DiscordContextMenu<MessageContextMenuCommandInteraction> {
  override metadata = new DiscordContextMenuMetadata()
    .setName('Scan Spark Log')
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral)
    .setType(ApplicationCommandType.Message);

  override async execute(interaction: InteractionWithGuild<MessageContextMenuCommandInteraction>) {
    const config = this.discord.application.config.sparkAnalysis;
    if (!config.enabled) throw new PolyHelperError('Spark analysis is disabled');

    const sparkId = findSparkId(interaction.targetMessage.content);
    if (!sparkId) throw new PolyHelperError("That isn't a spark.lucko.me link");
    const { analysisMessage, fixMessage } = await this.discord.application.spark.scanSparkLog({
      sparkId,
      supportNotes: null,
      channelId: interaction.channel.id,
      channelUrl: interaction.channel.url,
      requester: interaction.user.id
    });
    await interaction.followUp({
      embeds: [
        new EmbedHelper()
          .setTitle('Analyzing Spark Profile')
          .setURL(getSparkURL(sparkId))
          .setDescription(`Analysis: ${analysisMessage.url}\nProposed fix: ${fixMessage.url}`)
      ]
    });
  }
}

export default ScanSparkLogContextMenu;
