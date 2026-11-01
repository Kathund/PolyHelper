import Application from '../../../../Application.ts';
import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { TicketSearchFilterModal } from '../../../private/ComponentHelper.ts';
import type { ButtonInteraction } from 'discord.js';

class TicketSearchFilterButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilter')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get(`ticket:search:${id}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');
    await interaction.showModal(
      TicketSearchFilterModal(filters, this.discord.application.database.getPanels())
        .setTitle('Edit Ticket Filters')
        .setCustomId(interaction.customId)
    );
  }
}

export default TicketSearchFilterButton;
