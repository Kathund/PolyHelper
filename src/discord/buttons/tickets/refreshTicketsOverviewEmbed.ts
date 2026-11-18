import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import TicketsCommand from '../../commands/tickets/tickets.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class RefreshTicketsOverviewEmbedButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('refreshTicketsOverviewEmbed')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.editReply(
      TicketsCommand.getTicketsOverviewMessageData(
        this.discord.application.database.getPanels(),
        this.discord.application.database.getCloseRequests()
      )
    );
  }
}

export default RefreshTicketsOverviewEmbedButton;
