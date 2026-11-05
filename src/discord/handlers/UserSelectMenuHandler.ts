import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { MessageFlags, type UserSelectMenuInteraction } from 'discord.js';
import type DiscordUserSelectMenu from '../private/interactions/DiscordUserSelectMenu.ts';

class UserSelectMenuHandler extends BasicInteractionHandler<UserSelectMenuInteraction, DiscordUserSelectMenu> {
  override getRawIdFromInteraction(interaction: UserSelectMenuInteraction) {
    return interaction.customId;
  }

  override getIdFromInteraction(interaction: UserSelectMenuInteraction) {
    return interaction.customId.split(':', 1)[0] ?? interaction.customId;
  }

  override async handleResponse(interaction: UserSelectMenuInteraction, element: DiscordUserSelectMenu) {
    if (element.metadata.response === InteractionResponse.None) return;
    if (element.metadata.response === InteractionResponse.Update) return await interaction.deferUpdate();
    await interaction.deferReply({
      flags: element.metadata.response === InteractionResponse.Ephemeral ? MessageFlags.Ephemeral : undefined
    });
  }

  async loadElements() {
    await this.loadElementsGeneric('userSelectMenus');
    console.discord(`Successfully loaded ${this.elements.size} user select menu(s).`);
  }
}

export default UserSelectMenuHandler;
