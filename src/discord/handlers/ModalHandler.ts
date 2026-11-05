import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import type DiscordModal from '../private/interactions/DiscordModal.ts';

class ModalHandler extends BasicInteractionHandler<ModalSubmitInteraction, DiscordModal> {
  override getRawIdFromInteraction(interaction: ModalSubmitInteraction) {
    return interaction.customId;
  }

  override getIdFromInteraction(interaction: ModalSubmitInteraction) {
    return interaction.customId.split(':', 1)[0] ?? interaction.customId;
  }

  override async handleResponse(interaction: ModalSubmitInteraction, element: DiscordModal) {
    if (element.metadata.response === InteractionResponse.None) return;
    if (element.metadata.response === InteractionResponse.Update) return await interaction.deferUpdate();
    await interaction.deferReply({
      flags: element.metadata.response === InteractionResponse.Ephemeral ? MessageFlags.Ephemeral : undefined
    });
  }

  async loadElements() {
    await this.loadElementsGeneric('modals');
    console.discord(`Successfully loaded ${this.elements.size} modal(s).`);
  }
}

export default ModalHandler;
