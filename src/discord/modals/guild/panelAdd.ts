import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { DatabasePanel } from '../../../types/database.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class PanelAddModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('panelAdd')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const panelData: Omit<DatabasePanel, 'id'> = {
      name: interaction.fields.getTextInputValue('name'),
      cleanName: interaction.fields.getTextInputValue('name'),
      title: interaction.fields.getTextInputValue('title'),
      description: interaction.fields.getTextInputValue('description'),
      buttonLabel: interaction.fields.getTextInputValue('buttonLabel'),
      buttonEmoji: null,
      openingMessage: interaction.fields.getTextInputValue('title'),
      maxOpenTickets: 1,
      pinnedTicketPrefix: '📌',
      closedTicketPrefix: 'Closed',
      defaultTicketName: '[{cleanPanelName}] ticket-{username}',
      pingSupportRoleOnOpen: 1,
      supportTeamId: null,
      enabled: this.getCheckbox(interaction, 'enabled') ? 1 : 0
    };

    const panel = await this.discord.application.database.insertPanel(panelData);
    await interaction.followUp({ content: `Panel "${panel.name}" created.` });
  }
}

export default PanelAddModal;
