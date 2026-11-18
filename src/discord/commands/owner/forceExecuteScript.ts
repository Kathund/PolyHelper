import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper, { SuccessEmbed } from '../../private/EmbedHelper.ts';
import PolyHelperError from '../../../private/error.ts';
import prettyMilliseconds from 'pretty-ms';
import { InteractionPermission, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class ForceExecuteScriptCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('force-execute-script')
    .setDescription('Allows executing scripts')
    .addStringOption((option) =>
      option.setName('script-name').setDescription('Script Name').setRequired(true).setAutocomplete(true)
    )
    .setPermission(InteractionPermission.Owner);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const scriptName = interaction.options.getString('script-name', true);
    const script = this.discord.application.scripts.getScript(scriptName);
    if (!script) throw new PolyHelperError('Could not find that script?');
    await interaction.followUp({ embeds: [new EmbedHelper().setDescription(`Executing \`${script.id}\` script`)] });
    const duration = await script.runNow();
    await interaction.followUp({
      embeds: [
        new SuccessEmbed()
          .setDescription(`Finished executing \`${script.id}\` script`)
          .addFields({ name: 'Duration', value: `${duration.toFixed(2)}ms (${prettyMilliseconds(duration)})` })
      ]
    });
  }
}

export default ForceExecuteScriptCommand;
