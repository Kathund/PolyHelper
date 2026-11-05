import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction
} from 'discord.js';
import { InteractionFlag, InteractionPermission, type InteractionWithGuild } from '../../../../types/discord.ts';
import { TicketSearchResults } from '../../../private/ComponentHelper.ts';
import type CloseRequest from '../../../../database/private/CloseRequest.ts';
import type Panel from '../../../../database/private/Panel.ts';
import type { TicketSearch } from '../../../../types/misc.ts';

class TicketsCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('tickets')
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('View information for a ticket')
        .addStringOption((option) =>
          option.setName('ticket-id').setDescription('The ticket id').setAutocomplete(true).setRequired(true)
        )
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
          option
            .setName('tagged-github-repo')
            .setDescription('Search tickets by tagged github repo')
            .setAutocomplete(true)
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
    .addSubcommand((option) => option.setName('overview').setDescription('Overview of the tickets'))
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support);

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const ticketId = interaction.options.getString('ticket-id', true);
    const ticket = this.discord.application.database.getTicket(ticketId);
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
      taggedProject: interaction.options.getString('tagged-github-repo') ?? undefined,
      closedBy: interaction.options.getUser('closed-by')?.id
    };

    const tickets = this.discord.application.database.getTickets({ ...search, limit: 25 });
    await interaction.followUp(TicketSearchResults(tickets, search));
  }

  static getTicketsOverviewMessageData(panels: Panel[], closeRequests: CloseRequest[]): BaseMessageOptions {
    const parsedPanels = panels.sort((a, b) => a.name.localeCompare(b.name)).map((panel) => panel.getOverviewFields());
    return {
      embeds: [
        new EmbedHelper()
          .setStyle('DataInfo')
          .setTitle('Showing Tickets Overview')
          .setFields(
            parsedPanels.map((panel) => ({
              name: panel.name,
              value: [
                `**ID:** \`${panel.id}\``,
                `**Enabled:** ${panel.enabled ? ':white_check_mark: Yes' : ':x: No'}`,
                `**Total Tickets:** ${panel.tickets}`,
                `**Open Tickets:** ${panel.openTickets}`,
                `**Pinned Tickets:** ${panel.pinnedTickets}`
              ].join('\n'),
              inline: true
            }))
          )
          .addFields(
            {
              name: 'Total Tickets',
              value: parsedPanels.reduce((total, panel) => total + panel.tickets, 0),
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Open Tickets',
              value: parsedPanels.reduce((total, panel) => total + panel.openTickets, 0),
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Pinned Tickets',
              value: parsedPanels.reduce((total, panel) => total + panel.pinnedTickets, 0),
              inline: true,
              format: 'Number'
            },
            { name: 'Total Close Requests', value: closeRequests.length, inline: true, format: 'Number' },
            {
              name: 'Total Close Requests With Auto Close',
              value: closeRequests.filter((closeRequest) => closeRequest.autoClose !== null).length,
              inline: true,
              format: 'Number'
            }
          )
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().setComponents(
          new ButtonBuilder()
            .setCustomId('joinActiveTickets')
            .setLabel('Join Ticket Threads')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setLabel('Refresh Embed')
            .setCustomId('refreshTicketsOverviewEmbed')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    };
  }

  async executeOverview(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp(
      TicketsCommand.getTicketsOverviewMessageData(
        this.discord.application.database.getPanels(),
        this.discord.application.database.getCloseRequests()
      )
    );
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default TicketsCommand;
