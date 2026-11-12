import Application from '../../../../Application.ts';
import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { getSearchContainer } from '../../../private/ComponentHelper.ts';
import type { TicketSearch } from '../../../../types/misc.ts';

class TicketSearchFilterButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilter')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get<TicketSearch>(`ticket:search:${id}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');
    const searchId = crypto.randomUUID();
    Application.cache.set<TicketSearch>(`ticket:search:${searchId}`, filters);
    Application.cache.set(`ticket:search:message:${searchId}`, {
      channelId: interaction.message.channelId,
      messageId: interaction.message.id
    });
    await interaction.reply({
      components: [
        getSearchContainer(
          filters,
          this.discord.application.database.getPanels(),
          filters.taggedProjectId ? this.discord.application.database.getProject(filters.taggedProjectId) : undefined,
          searchId
        )
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
  }
}

export default TicketSearchFilterButton;
