import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../types/discord.ts';
import { TicketActionEmbed } from '../../private/EmbedHelper.ts';
import type { ButtonInteraction } from 'discord.js';

class SilenceTicketInactivityButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('silenceTicketInactivity')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.followUp({ content: 'Attempting to silence this ticket...' });
    const ticket = this.getTicket(interaction);
    this.discord.application.database.updateTicket({ ...ticket.toJSON(), inactivitySilenced: 1 });
    const message = await ticket.getInactivityMessage();
    if (message) {
      await message.reply({
        embeds: [
          new TicketActionEmbed({ title: 'Inactivity Silenced', executor: interaction.user }).setFields({
            name: '_ _',
            value: 'Inactivity posts will **NEVER** be resent in this ticket'
          })
        ]
      });
    }
  }
}

export default SilenceTicketInactivityButton;
