import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import type { StringSelectMenuInteraction } from 'discord.js';

class TicketSearchSelector extends DiscordStringSelectMenu {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketsSearch')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: StringSelectMenuInteraction) {
    const ticketId = interaction.values[0];
    if (!ticketId) throw new PolyHelperError('Could not find the a ticket id');
    const ticket = this.discord.application.database.getTicket(ticketId);
    if (!ticket) throw new PolyHelperError('Could not find the matching ticket?');
    const [ownerId] = this.getArgs(interaction);
    if (ownerId === interaction.user.id) await interaction.update(await ticket.toMessageData());
    else await interaction.reply(await ticket.toMessageData());
  }
}

export default TicketSearchSelector;
