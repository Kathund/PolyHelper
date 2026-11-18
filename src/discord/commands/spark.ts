import DiscordCommand from '../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../types/discord.ts';
import { findSparkId } from '../../utils/sparkUtils.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class SparkCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('spark')
    .setDescription('Analyze spark profiles with Claude')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('analyze')
        .setDescription('Find what is costing FPS or TPS in one spark profile')
        .addStringOption((option) =>
          option.setName('link').setDescription('The spark.lucko.me link to analyze').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('notes')
            .setDescription('What the user is seeing, e.g. FPS drops when opening their inventory')
            .setMaxLength(1000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('compare')
        .setDescription('Find what changed between two spark profiles')
        .addStringOption((option) =>
          option
            .setName('baseline')
            .setDescription('The spark.lucko.me link to compare against, e.g. without mods or before an update')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('link').setDescription('The spark.lucko.me link with the problem').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('notes')
            .setDescription('What differs between the two, e.g. same world, second one has PolyBlur')
            .setMaxLength(1000)
        )
    )
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral)
    .setCleanErrorTitle('analyze this spark profile');

  private getSparkId(interaction: ChatInputCommandInteraction, name: string): string {
    const sparkId = findSparkId(interaction.options.getString(name, true));
    if (!sparkId) throw new PolyHelperError(`The ${name} isn't a spark.lucko.me link`);
    return sparkId;
  }

  async executeAnalyze(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await this.discord.application.spark.scanSparkLog({
      mode: 'analyze',
      sparkId: this.getSparkId(interaction, 'link'),
      baselineId: null,
      supportNotes: interaction.options.getString('notes'),
      interaction
    });
  }

  async executeCompare(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await this.discord.application.spark.scanSparkLog({
      mode: 'compare',
      sparkId: this.getSparkId(interaction, 'link'),
      baselineId: this.getSparkId(interaction, 'baseline'),
      supportNotes: interaction.options.getString('notes'),
      interaction
    });
  }

  override execute(): Promise<void> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default SparkCommand;
