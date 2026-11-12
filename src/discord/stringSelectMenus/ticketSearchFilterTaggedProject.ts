import Application from '../../Application.ts';
import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { getSearchContainer } from '../private/ComponentHelper.ts';
import type { StringSelectMenuInteraction } from 'discord.js';
import type { TicketSearch } from '../../types/misc.ts';

class TicketSearchFilterTaggedProjectSelector extends DiscordStringSelectMenu {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilterTaggedProject')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: StringSelectMenuInteraction) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get<TicketSearch>(`ticket:search:${id}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');

    const value = interaction.values[0];
    if (value === undefined) throw new PolyHelperError(`Could not get the "${value}" project`);
    const project = this.discord.application.database.getProject(value);
    if (!project) throw new PolyHelperError(`Could not get the "${value}" project`);
    filters.taggedProjectId = project.id;
    Application.cache.set<TicketSearch>(`ticket:search:${id}`, filters);

    await interaction.editReply({
      components: [
        getSearchContainer(
          filters,
          this.discord.application.database.getPanels(),
          filters.taggedProjectId ? this.discord.application.database.getProject(filters.taggedProjectId) : undefined,
          id
        )
      ]
    });
  }
}

export default TicketSearchFilterTaggedProjectSelector;
