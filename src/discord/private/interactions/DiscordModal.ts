import BasicInteractionData from './basic/BasicInteractionData.ts';
import PolyHelperError from '../../../private/error.ts';
import type { ModalSubmitInteraction } from 'discord.js';

abstract class DiscordModal extends BasicInteractionData<ModalSubmitInteraction> {
  protected getTextInputValue(interaction: ModalSubmitInteraction, customId: string): string | undefined {
    try {
      return interaction.fields.getTextInputValue(customId).trim();
    } catch {
      return undefined;
    }
  }

  protected getSelectedChannels(interaction: ModalSubmitInteraction, customId: string): string[] {
    try {
      return interaction.fields.getSelectedChannels(customId, true).map((channel) => channel.id);
    } catch {
      return [];
    }
  }

  protected getSelectedRoles(interaction: ModalSubmitInteraction, customId: string): string[] {
    try {
      return interaction.fields
        .getSelectedRoles(customId, true)
        .filter((role) => role !== null)
        .map((role) => role.id);
    } catch {
      return [];
    }
  }

  protected getSelectedRole(interaction: ModalSubmitInteraction, customId: string): string {
    const role = this.getSelectedRoles(interaction, customId)[0];
    if (!role) throw new PolyHelperError(`Could not get the "${customId}" role. There were no selected roles`);
    return role;
  }

  protected getCheckbox(interaction: ModalSubmitInteraction, customId: string, defaultValue: boolean = true): boolean {
    try {
      return interaction.fields.getCheckbox(customId);
    } catch {
      return defaultValue;
    }
  }

  protected getRadioGroup(interaction: ModalSubmitInteraction, customId: string): string | undefined {
    try {
      return interaction.fields.getRadioGroup(customId) ?? undefined;
    } catch {
      return undefined;
    }
  }

  protected getStringSelectValues(interaction: ModalSubmitInteraction, customId: string): string[] {
    try {
      return interaction.fields.getStringSelectValues(customId).map((value) => value);
    } catch {
      return [];
    }
  }

  protected getStringSelectValue(interaction: ModalSubmitInteraction, customId: string): string | undefined {
    return this.getStringSelectValues(interaction, customId)[0];
  }
}

export default DiscordModal;
