import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class RefreshDataButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('refreshData')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.editReply(await this.getDatabaseData(interaction).toMessageData());
  }
}

export default RefreshDataButton;
