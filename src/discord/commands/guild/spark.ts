import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../private/EmbedHelper.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../types/discord.ts';
import { findSparkId, getSparkURL } from '../../../utils/sparkUtils.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class SparkCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('spark')
    .setDescription('Analyze a spark profile with Claude and write a fix brief')
    .addStringOption((option) =>
      option.setName('link').setDescription('The spark.lucko.me link to analyze').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('notes')
        .setDescription('What the user is seeing, e.g. FPS drops when opening their inventory')
        .setMaxLength(1000)
    )
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral)
    .setCleanErrorTitle('analyze this spark profile');

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const config = this.discord.application.config.sparkAnalysis;
    if (!config.enabled) throw new PolyHelperError('Spark analysis is disabled');

    const sparkId = findSparkId(interaction.options.getString('link', true));
    if (!sparkId) throw new PolyHelperError("That isn't a spark.lucko.me link");

    const { analysisMessage, fixMessage } = await this.discord.application.spark.scanSparkLog({
      sparkId,
      supportNotes: interaction.options.getString('notes'),
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

export default SparkCommand;
