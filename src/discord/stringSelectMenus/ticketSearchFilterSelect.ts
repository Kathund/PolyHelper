import Application from '../../Application.ts';
import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { getOrganizationRepositories } from '../../utils/githubUtils.ts';
import { getSearchContainer } from '../private/ComponentHelper.ts';
import type { StringSelectMenuInteraction } from 'discord.js';
import type { TicketSearch } from '../../types/misc.ts';

class TicketSearchFilterSelect extends DiscordStringSelectMenu {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilterSelect')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: StringSelectMenuInteraction) {
    const [searchId, filter] = this.getArgs(interaction);
    if (!searchId || !filter) throw new PolyHelperError('Could not find the ticket search filter');
    const search = Application.cache.get<TicketSearch>(`ticket:search:${searchId}`);
    if (!search) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');

    const value = interaction.values[0];
    if (value === undefined) throw new PolyHelperError(`Could not get the "${filter}" ticket filter`);

    switch (filter) {
      case 'panelId':
        search.panelId = value === '__any__' ? undefined : value;
        break;
      case 'taggedProject':
        search.taggedProject = value === '__any__' ? undefined : value;
        break;
      case 'pinned':
      case 'closed':
      case 'inactivitySilenced':
        if (value === 'any') search[filter] = undefined;
        else if (value === 'true') search[filter] = true;
        else if (value === 'false') search[filter] = false;
        else throw new PolyHelperError(`Invalid value for the "${filter}" ticket filter`);
        break;
      default:
        throw new PolyHelperError(`Invalid ticket search filter "${filter}"`);
    }

    Application.cache.set<TicketSearch>(`ticket:search:${searchId}`, search);
    await interaction.editReply({
      components: [
        getSearchContainer(
          search,
          this.discord.application.database.getPanels(),
          await getOrganizationRepositories(),
          searchId
        )
      ]
    });
  }
}

export default TicketSearchFilterSelect;
