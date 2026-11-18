import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class RefreshDataButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('refreshData')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.editReply(await this.getDatabaseData(interaction).toMessageData());
  }
}

export default RefreshDataButton;
