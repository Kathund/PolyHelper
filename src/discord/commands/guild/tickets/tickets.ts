import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import {
  type EmbedHelperField,
  InteractionFlag,
  InteractionPermission,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import { titleCase } from '../../../../utils/stringUtils.ts';
import type Panel from '../../../../database/private/Panel.ts';
import type Ticket from '../../../../database/private/Ticket.ts';
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
        .addUserOption((option) => option.setName('opener').setDescription('The person who opened the ticket'))
        .addBooleanOption((option) => option.setName('pinned').setDescription('Is the ticket currently pinned'))
        .addBooleanOption((option) => option.setName('unpinned').setDescription('Is the ticket currently unpinned'))
        .addBooleanOption((option) => option.setName('closed').setDescription('Is the ticket currently closed'))
        .addBooleanOption((option) => option.setName('open').setDescription('Is the ticket currently open'))
    )
    .addSubcommand((option) => option.setName('overview').setDescription('Overview of the tickets'))
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support);

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const ticketId = interaction.options.getString('ticket-id', true);
    const ticket = this.discord.application.database.getTicket(ticketId);
    if (!ticket) throw new PolyHelperError('Could not find the matching ticket?');
    await interaction.followUp(await ticket.getMessageData());
  }

  static getTicketsSearchMessageData(tickets: Ticket[], search: TicketSearch, owner: string): BaseMessageOptions {
    const embed = new EmbedHelper()
      .setTitle('Ticket Search')
      .setDescription(`Found **${tickets.length} ticket(s)** with the following filter(s)`)
      .addFields(
        (['pinned', 'unpinned', 'closed', 'open'] as const)
          .filter((option) => search[option] !== undefined)
          .map((option): EmbedHelperField => ({ name: titleCase(option), value: search[option]!, format: 'Boolean' }))
      );

    if (search.panelId) embed.addFields({ name: 'Panel Id', value: search.panelId, format: 'Block' });
    if (search.owner) embed.addFields({ name: 'Owner', value: `<@${search.owner}> (${search.owner})` });

    return {
      embeds: [embed.setFields(embed.fields.map((field) => ({ ...field, inline: true })))],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ticketsSearch:${owner}`)
            .setPlaceholder(tickets.length === 0 ? 'No tickets found' : 'Select a ticket to view more')
            .setDisabled(tickets.length === 0)
            .setOptions(
              tickets.length === 0
                ? [new StringSelectMenuOptionBuilder().setLabel('No tickets found').setValue('nothing')]
                : tickets.map((ticket) =>
                    new StringSelectMenuOptionBuilder()
                      .setLabel(`${ticket.name} - ${new Date(ticket.openingTimestamp).toISOString().split('T')[0]}`)
                      .setValue(ticket.id)
                  )
            )
        )
      ]
    };
  }

  async executeSearch(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const panelId = interaction.options.getString('panel-id');
    const opener = interaction.options.getUser('opener');
    const pinned = interaction.options.getBoolean('pinned');
    const unpinned = interaction.options.getBoolean('unpinned');
    const closed = interaction.options.getBoolean('closed');
    const open = interaction.options.getBoolean('open');

    if (pinned !== null && unpinned !== null && pinned === unpinned) {
      throw new PolyHelperError('The pinned and unpinned filters conflict with each other');
    }

    if (closed !== null && open !== null && closed === open) {
      throw new PolyHelperError('The closed and open filters conflict with each other');
    }

    const search: TicketSearch = {
      panelId: panelId ?? undefined,
      owner: opener?.id,
      pinned: pinned ?? (unpinned === null ? undefined : !unpinned),
      unpinned: unpinned ?? undefined,
      closed: closed ?? undefined,
      open: open ?? undefined
    };

    const tickets = this.discord.application.database.getTickets({
      panelId: search.panelId,
      owner: search.owner,
      pinned: search.pinned,
      closed: closed === null ? (open === null ? undefined : open ? 0 : 1) : closed ? 1 : 0,
      limit: 25
    });

    await interaction.followUp(TicketsCommand.getTicketsSearchMessageData(tickets, search, interaction.user.id));
  }

  static getTicketsOverviewMessageData(panels: Panel[]): BaseMessageOptions {
    const parsedPanels = panels.map((panel) => panel.getOverviewFields());
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
              value: parsedPanels.reduce((total, panel) => total + panel.tickets, 0).toString(),
              inline: true
            },
            {
              name: 'Total Open Tickets',
              value: parsedPanels.reduce((total, panel) => total + panel.openTickets, 0).toString(),
              inline: true
            },
            {
              name: 'Total Pinned Tickets',
              value: parsedPanels.reduce((total, panel) => total + panel.pinnedTickets, 0).toString(),
              inline: true
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
      TicketsCommand.getTicketsOverviewMessageData(this.discord.application.database.getPanels())
    );
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default TicketsCommand;
