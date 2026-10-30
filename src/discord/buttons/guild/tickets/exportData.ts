import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import { AttachmentBuilder, type ButtonInteraction } from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';

class ExportDataButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('exportData')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.followUp({
      files: [
        new AttachmentBuilder(
          Buffer.from(JSON.stringify(this.getDatabaseData(interaction).toJSON(), null, 2), 'utf8'),
          { name: 'data.json' }
        )
      ]
    });
  }
}

export default ExportDataButton;
