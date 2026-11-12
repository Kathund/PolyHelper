import Application from '../../../../Application.ts';
import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { TicketSearchResults } from '../../../private/ComponentHelper.ts';
import type { TicketSearch } from '../../../../types/misc.ts';

class TicketSearchApplyButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchApply')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [searchId] = this.getArgs(interaction);
    if (!searchId) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get<TicketSearch>(`ticket:search:${searchId}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');
    const source = Application.cache.get<{ channelId: string; messageId: string }>(`ticket:search:message:${searchId}`);
    if (!source) throw new PolyHelperError('Could not find the original ticket search. Run the search again.');

    const tickets = this.discord.application.database.getTickets({ ...filters, limit: 25 });
    const channel = await interaction.guild.channels.fetch(source.channelId);
    if (!channel?.isTextBased() || !('messages' in channel)) {
      throw new PolyHelperError('Could not find the channel containing the original ticket search.');
    }

    const message = await channel.messages.fetch(source.messageId);
    await message.edit({
      components: TicketSearchResults(
        tickets,
        filters,
        filters.taggedProjectId ? this.discord.application.database.getProject(filters.taggedProjectId) : undefined
      ),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
    await interaction.deleteReply();
  }
}

export default TicketSearchApplyButton;
