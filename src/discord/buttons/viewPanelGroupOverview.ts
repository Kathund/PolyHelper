import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import EmbedHelper from '../private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import {
  type EmbedHelperField,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../types/discord.ts';
import type CloseRequest from '../../database/private/CloseRequest.ts';
import type Ticket from '../../database/private/Ticket.ts';
import type { ButtonInteraction } from 'discord.js';

class ViewPanelGroupOverviewButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('viewPanelGroupOverview')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel group?');
    const group = this.discord.application.database.getPanelGroup(id);
    if (!group) throw new PolyHelperError('Could not find the matching panel group?');
    const parsedPanels: (EmbedHelperField & { tickets: Ticket[]; closeRequests: CloseRequest[] })[] = group.panels.map(
      (panel) => {
        const tickets = panel.getTickets();
        const closeRequests = panel.getCloseRequests();
        return {
          name: panel.name,
          value: [
            `**ID:** \`${panel.id}\``,
            `**Status:** ${panel.enabled ? ':white_check_mark: Enabled' : ':x: Disabled'}`,
            `**Total Tickets:** ${tickets.length}`,
            `**Open Tickets:** ${tickets.filter((ticket) => !ticket.closed).length}`,
            `**Pinned Tickets:** ${tickets.filter((ticket) => ticket.pinned).length}`,
            `**Close Requests:** ${closeRequests.length}`,
            `**Auto-Close Requests:** ${closeRequests.filter((closeRequest) => closeRequest.autoClose !== null).length}`
          ].join('\n'),
          tickets,
          closeRequests
        };
      }
    );

    await interaction.followUp({
      embeds: [
        new EmbedHelper()
          .setStyle('DataInfo')
          .setTitle('Panel Group Overview')
          .setFields(parsedPanels)
          .addFields(
            {
              name: 'Total Tickets',
              value: parsedPanels.flatMap((panel) => panel.tickets).length,
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Open Tickets',
              value: parsedPanels.flatMap((panel) => panel.tickets).filter((ticket) => !ticket.closed).length,
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Pinned Tickets',
              value: parsedPanels.flatMap((panel) => panel.tickets).filter((ticket) => ticket.pinned).length,
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Close Requests',
              value: parsedPanels.flatMap((panel) => panel.closeRequests).length,
              inline: true,
              format: 'Number'
            },
            {
              name: 'Total Auto-Close Requests',
              value: parsedPanels
                .flatMap((panel) => panel.closeRequests)
                .filter((closeRequest) => closeRequest.autoClose !== null).length,
              inline: true,
              format: 'Number'
            }
          )
      ]
    });
  }
}

export default ViewPanelGroupOverviewButton;
