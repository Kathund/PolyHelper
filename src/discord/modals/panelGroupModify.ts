import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../private/interactions/DiscordModal.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../types/discord.ts';
import type PanelGroup from '../../database/private/PanelGroup.ts';
import type { BaseDatabaseItem, DatabasePanelGroup } from '../../types/database.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class PanelGroupModifyModal extends DiscordModal {
  override readonly metadata = new BasicInteractionMetadata('panelGroupModify').setResponse(
    InteractionResponse.Ephemeral
  );

  private getPanelGroup(interaction: ModalMessageModalSubmitInteraction): PanelGroup | undefined {
    const [id] = this.getArgs(interaction);
    if (!id) return undefined;
    return this.discord.application.database.getPanelGroup(id);
  }

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const panelGroup = this.getPanelGroup(interaction);
    const data: Omit<DatabasePanelGroup, keyof BaseDatabaseItem> = {
      name: this.getTextInputValue(interaction, 'name') ?? panelGroup?.name ?? 'UNKNOWN',
      channelId: this.getSelectedChannel(interaction, 'channelId', true),
      messageId: panelGroup?.messageId ?? null
    };

    const [id] = this.getArgs(interaction);
    if (id === undefined) {
      const panel = this.discord.application.database.insertPanelGroup(data);
      await interaction.followUp({ ...panel.toMessageData(), content: `Panel Group "${panel.name}" created.` });
    } else {
      const panel = this.discord.application.database.updatePanelGroup({ id, ...data });
      await interaction.followUp({ content: `Panel Group "${panel.name}" updated.` });
    }
  }
}

export default PanelGroupModifyModal;
