import Application from '../../Application.ts';
import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordUserSelectMenu from '../private/interactions/DiscordUserSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { getOrganizationRepositories } from '../../utils/githubUtils.ts';
import { getSearchContainer } from '../private/ComponentHelper.ts';
import type { TicketSearch } from '../../types/misc.ts';
import type { UserSelectMenuInteraction } from 'discord.js';

class TicketSearchFilterUser extends DiscordUserSelectMenu {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilterUser')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: UserSelectMenuInteraction) {
    const [searchId, filter] = this.getArgs(interaction);
    if (!searchId || (filter !== 'owner' && filter !== 'closedBy')) {
      throw new PolyHelperError('Invalid ticket search user filter');
    }
    const search = Application.cache.get<TicketSearch>(`ticket:search:${searchId}`);
    if (!search) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');

    const userId = interaction.values[0];
    if (filter === 'owner') search.owner = userId;
    else search.closedBy = userId;

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

export default TicketSearchFilterUser;
