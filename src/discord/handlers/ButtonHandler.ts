import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { InteractionResponse } from '../../types/discord.ts';
import type DiscordButton from '../private/interactions/DiscordButton.ts';

class ButtonHandler extends BasicInteractionHandler<ButtonInteraction, DiscordButton> {
  override getRawIdFromInteraction(interaction: ButtonInteraction) {
    return interaction.customId;
  }

  override getIdFromInteraction(interaction: ButtonInteraction) {
    return interaction.customId.split(':', 1)[0] ?? interaction.customId;
  }

  override async handleResponse(interaction: ButtonInteraction, element: DiscordButton) {
    if (element.metadata.response === InteractionResponse.None) return;
    if (element.metadata.response === InteractionResponse.Update) return await interaction.deferUpdate();
    await interaction.deferReply({
      flags: element.metadata.response === InteractionResponse.Ephemeral ? MessageFlags.Ephemeral : undefined
    });
  }

  override async loadElements() {
    await this.loadElementsGeneric('buttons');
    console.discord(`Successfully loaded ${this.elements.size} button(s).`);
  }
}

export default ButtonHandler;
