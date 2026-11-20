import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class DeprecatedButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata([
    'refreshTicketsOverviewEmbed',
    'joinActiveTickets',
    'closeRequestAccept',
    'closeRequestDeny'
  ])
    .setResponse(InteractionResponse.Ephemeral)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.followUp({ content: 'This has been deprecated and will no longer work' });
  }
}

export default DeprecatedButton;
