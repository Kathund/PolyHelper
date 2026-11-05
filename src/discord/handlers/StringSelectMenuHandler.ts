import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { MessageFlags, type StringSelectMenuInteraction } from 'discord.js';
import type DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';

class StringSelectMenuHandler extends BasicInteractionHandler<StringSelectMenuInteraction, DiscordStringSelectMenu> {
  override getRawIdFromInteraction(interaction: StringSelectMenuInteraction) {
    return interaction.customId;
  }

  override getIdFromInteraction(interaction: StringSelectMenuInteraction) {
    return interaction.customId.split(':', 1)[0] ?? interaction.customId;
  }

  override async handleResponse(interaction: StringSelectMenuInteraction, element: DiscordStringSelectMenu) {
    if (element.metadata.response === InteractionResponse.None) return;
    if (element.metadata.response === InteractionResponse.Update) return await interaction.deferUpdate();
    await interaction.deferReply({
      flags: element.metadata.response === InteractionResponse.Ephemeral ? MessageFlags.Ephemeral : undefined
    });
  }

  async loadElements() {
    await this.loadElementsGeneric('stringSelectMenus');
    console.discord(`Successfully loaded ${this.elements.size} string select menu(s).`);
  }
}

export default StringSelectMenuHandler;
