import Application from '../../../Application.ts';
import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { TicketSearchResults } from '../../private/ComponentHelper.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';
import type { TicketSearch } from '../../../types/misc.ts';

class TicketSearchFiltersModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilter')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  private getBooleanFilter(interaction: ModalMessageModalSubmitInteraction, customId: string): boolean | undefined {
    const value = this.getRadioGroup(interaction, customId);
    if (value === undefined || value === 'any') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new PolyHelperError(`Invalid value for the "${customId}" ticket filter`);
  }

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const [searchId] = this.getArgs(interaction);
    if (searchId === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const previousFilters = Application.cache.get<TicketSearch>(`ticket:search:${searchId}`);
    if (!previousFilters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');

    const filters: TicketSearch = {
      panelId: this.getStringSelectValue(interaction, 'panelId') || undefined,
      owner: this.getSelectedUser(interaction, 'owner') || undefined,
      pinned: this.getBooleanFilter(interaction, 'pinned'),
      closed: this.getBooleanFilter(interaction, 'closed'),
      inactivitySilenced: this.getBooleanFilter(interaction, 'inactivitySilenced')
    };

    const tickets = this.discord.application.database.getTickets({ ...filters, limit: 25 });
    await interaction.editReply(TicketSearchResults(tickets, filters));
  }
}

export default TicketSearchFiltersModal;
