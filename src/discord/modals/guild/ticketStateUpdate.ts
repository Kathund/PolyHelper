import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../types/discord.ts';
import { getReason } from '../../../utils/stringUtils.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class TicketStateUpdateModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata([
    'reopenTicket',
    'closeTicket',
    'unpinTicket',
    'pinTicket'
  ])
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral)
    .setFlags(InteractionFlag.RequiresGuild);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this ticket?');
    const ticket = this.discord.application.database.getTicket(id);
    if (!ticket) throw new PolyHelperError('Could not find this ticket?');
    const reason = getReason(interaction.fields.getTextInputValue('reason'));
    const rawId = this.getRawId(interaction);
    if (rawId === 'reopenTicket') {
      await interaction.followUp({ content: 'Attempting to open that ticket...' });
      await ticket.open({ reason, executor: interaction.user });
    } else if (rawId === 'closeTicket') {
      await interaction.followUp({ content: 'Attempting to close that ticket...' });
      await ticket.close({ reason, executor: interaction.user });
    } else if (rawId === 'unpinTicket') {
      await interaction.followUp({ content: 'Attempting to unpin that ticket...' });
      await ticket.unpin({ reason, executor: interaction.user });
    } else if (rawId === 'pinTicket') {
      await interaction.followUp({ content: 'Attempting to pin that ticket...' });
      await ticket.pin({ reason, executor: interaction.user });
    } else {
      await interaction.followUp({ content: 'Unknown type' });
    }
  }
}

export default TicketStateUpdateModal;
