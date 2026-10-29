import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class PanelEditModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('panelEdit')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel?');
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');

    const maxOpenTickets = Number(this.getTextInputValue(interaction, 'maxOpenTickets') ?? panel.maxOpenTickets);
    if (!Number.isSafeInteger(maxOpenTickets) || maxOpenTickets < 1) {
      throw new PolyHelperError('The maximum open tickets value must be a whole number greater than zero.');
    }

    const updated = await this.discord.application.database.updatePanel({
      id: panel.id,
      name: this.getTextInputValue(interaction, 'name') ?? panel.name,
      cleanName: this.getTextInputValue(interaction, 'cleanName') ?? panel.cleanName,
      title: this.getTextInputValue(interaction, 'title') ?? panel.title,
      description: this.getTextInputValue(interaction, 'description') ?? panel.description,
      buttonLabel: this.getTextInputValue(interaction, 'buttonLabel') ?? panel.buttonLabel,
      buttonEmoji: (this.getTextInputValue(interaction, 'buttonEmoji') ?? panel.buttonEmoji)?.trim() || null,
      openingMessage: this.getTextInputValue(interaction, 'openingMessage') ?? panel.openingMessage,
      maxOpenTickets,
      pinnedTicketPrefix: this.getTextInputValue(interaction, 'pinnedTicketPrefix') ?? panel.pinnedTicketPrefix,
      closedTicketPrefix: this.getTextInputValue(interaction, 'closedTicketPrefix') ?? panel.closedTicketPrefix,
      defaultTicketName: this.getTextInputValue(interaction, 'defaultTicketName') ?? panel.defaultTicketName,
      pingSupportRoleOnOpen: panel.pingSupportRoleOnOpen ? 1 : 0,
      supportTeamId: this.getTextInputValue(interaction, 'supportTeamId') ?? panel.supportTeamId,
      enabled: this.getCheckbox(interaction, 'enabled', panel.enabled) ? 1 : 0
    });
    await interaction.followUp({ content: `Panel "${updated.name}" updated.` });
  }
}

export default PanelEditModal;
