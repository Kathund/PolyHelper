import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type Panel from '../../../database/private/Panel.ts';
import type { DatabasePanel } from '../../../types/database.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class PanelModifyModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('panelModify')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  private getPanel(interaction: ModalMessageModalSubmitInteraction): Panel | undefined {
    const [id] = this.getArgs(interaction);
    if (!id) return undefined;
    return this.discord.application.database.getPanel(id);
  }

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const panel = this.getPanel(interaction);

    const maxOpenTickets = Number(this.getTextInputValue(interaction, 'maxOpenTickets') ?? panel?.maxOpenTickets ?? 1);
    if (!Number.isSafeInteger(maxOpenTickets) || maxOpenTickets < 1) {
      throw new PolyHelperError('The maximum open tickets value must be a whole number greater than zero.');
    }

    const data: Omit<DatabasePanel, 'id'> = {
      name: this.getTextInputValue(interaction, 'name') ?? panel?.name ?? 'UNKNOWN',
      title: this.getTextInputValue(interaction, 'title') ?? panel?.title ?? 'UNKNOWN',
      description: this.getTextInputValue(interaction, 'description') ?? panel?.description ?? 'UNKNOWN',
      buttonLabel:
        this.getTextInputValue(interaction, 'buttonLabel') ??
        panel?.buttonLabel ??
        this.getTextInputValue(interaction, 'name') ??
        'UNKNOWN',
      buttonEmoji: (this.getTextInputValue(interaction, 'buttonEmoji') ?? panel?.buttonEmoji)?.trim() || null,
      buttonStyle: Number(
        this.getRadioGroup(interaction, 'buttonStyle') ?? String(panel?.buttonStyle ?? 2)
      ) as DatabasePanel['buttonStyle'],
      openingMessage: this.getTextInputValue(interaction, 'openingMessage') ?? panel?.openingMessage ?? '{panelName}',
      openingMessageContent:
        this.getTextInputValue(interaction, 'openingMessageContent') ?? panel?.openingMessageContent ?? '{mention}',
      openingMessageTitle:
        this.getTextInputValue(interaction, 'openingMessageTitle') ?? panel?.openingMessageTitle ?? '{panelName}',
      maxOpenTickets,
      pinnedTicketPrefix:
        this.getTextInputValue(interaction, 'pinnedTicketPrefix') ?? panel?.pinnedTicketPrefix ?? '📌',
      closedTicketPrefix:
        this.getTextInputValue(interaction, 'closedTicketPrefix') ?? panel?.closedTicketPrefix ?? 'Closed',
      defaultTicketName:
        this.getTextInputValue(interaction, 'defaultTicketName') ??
        panel?.defaultTicketName ??
        '[{panelName}] ticket-{username}',
      pingSupportTeamOnOpen: (panel?.pingSupportTeamOnOpen ?? true) ? 1 : 0,
      supportTeamId: this.getStringSelectValue(interaction, 'supportTeamId') ?? panel?.supportTeamId ?? null,
      enabled: this.getCheckbox(interaction, 'enabled', panel?.enabled ?? true) ? 1 : 0
    };

    const [id] = this.getArgs(interaction);
    if (id === undefined) {
      const panel = await this.discord.application.database.insertPanel(data);
      await interaction.followUp({ ...panel.toMessageData(), content: `Panel "${panel.name}" created.` });
    } else {
      const panel = await this.discord.application.database.updatePanel({ id, ...data });
      await interaction.followUp({ content: `Panel "${panel.name}" updated.` });
    }
  }
}

export default PanelModifyModal;
