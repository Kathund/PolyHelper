import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import EmbedHelper, { SuccessEmbed } from '../../private/EmbedHelper.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class JoinActiveTicketsButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('joinActiveTickets')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const tickets = this.discord.application.database
      .getPanels({ enabled: true })
      .flatMap((panel) => panel.getTickets({ closed: false }));
    await interaction.followUp({
      embeds: [new EmbedHelper().setDescription(`Adding you to ${tickets.length} ticket(s)`)]
    });
    for (const ticket of tickets) {
      await ticket.addUser({ user: interaction.user, executor: interaction.user, silent: true });
    }
    await interaction.editReply({
      embeds: [new SuccessEmbed().setDescription(`Added you to ${tickets.length} ticket(s)`)]
    });
  }
}

export default JoinActiveTicketsButton;
