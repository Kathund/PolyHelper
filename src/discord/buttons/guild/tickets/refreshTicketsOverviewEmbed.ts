import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import TicketsCommand from '../../../commands/guild/tickets/tickets.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class RefreshTicketsOverviewEmbedButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('refreshTicketsOverviewEmbed')
    .setFlags(InteractionFlag.RequiresGuild)
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
