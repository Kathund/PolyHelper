import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../private/error.ts';
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { TicketSearchResults } from '../../private/ComponentHelper.ts';
import type Ticket from '../../../database/private/Ticket.ts';
import type { TicketSearch } from '../../../types/misc.ts';

class TicketsCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('tickets')
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('View information for a ticket')
        .addStringOption((option) => option.setName('ticket-id').setDescription('The ticket id').setAutocomplete(true))
    )
    .addSubcommand((option) =>
      option
        .setName('search')
        .setDescription('Search Tickets')
        .addStringOption((option) =>
          option.setName('panel-id').setDescription('Search tickets by panel id').setAutocomplete(true)
        )
        .addUserOption((option) => option.setName('owner').setDescription('The person who opened the ticket'))
        .addStringOption((option) =>
          option.setName('project').setDescription('Search tickets by tagged project').setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('pin-state')
            .setDescription('The current ticket pin state')
            .addChoices({ name: 'Pinned', value: 'pinned' }, { name: 'Unpinned', value: 'unpinned' })
        )
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('The current ticket state. Leave empty for both')
            .addChoices({ name: 'Open', value: 'open' }, { name: 'Closed', value: 'closed' })
        )
        .addStringOption((option) =>
          option
            .setName('inactivity-state')
            .setDescription('The current ticket inactivity state')
            .addChoices({ name: 'Silenced', value: 'silenced' }, { name: 'Unsilenced', value: 'unsilenced' })
        )
        .addUserOption((option) => option.setName('closed-by').setDescription('who closed the ticket'))
    )
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    let ticket: Ticket | undefined;
    const ticketId = interaction.options.getString('ticket-id');
    if (ticketId) ticket = this.discord.application.database.getTicket(ticketId);
    else ticket = this.getTicket(interaction);
    if (!ticket) throw new PolyHelperError('Could not find the matching ticket?');
    await interaction.followUp(await ticket.toMessageData());
  }

  async executeSearch(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const pinState = interaction.options.getString('pin-state');
    const state = interaction.options.getString('state');
    const inactivityState = interaction.options.getString('inactivity-state');

    const search: TicketSearch = {
      panelId: interaction.options.getString('panel-id') ?? undefined,
      owner: interaction.options.getUser('owner')?.id,
      pinned: pinState === null ? undefined : pinState === 'pinned',
      closed: state === null ? undefined : state === 'closed',
      inactivitySilenced: inactivityState === null ? undefined : inactivityState === 'silenced',
      taggedProjectId: interaction.options.getString('project') ?? undefined,
      closedBy: interaction.options.getUser('closed-by')?.id
    };

    const tickets = this.discord.application.database.getTickets({ ...search, limit: 25 });
    await interaction.followUp({
      components: TicketSearchResults(
        tickets,
        search,
        search.taggedProjectId ? this.discord.application.database.getProject(search.taggedProjectId) : undefined
      ),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default TicketsCommand;
