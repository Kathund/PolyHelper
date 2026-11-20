import BasicInteractionData from './basic/BasicInteractionData.ts';
import PolyHelperError from '../../../private/error.ts';
import type { ModalSubmitInteraction } from 'discord.js';

abstract class DiscordModal extends BasicInteractionData<ModalSubmitInteraction> {
  protected getTextInputValue(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: false
  ): string | undefined;
  protected getTextInputValue(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getTextInputValue(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    try {
      const value = interaction.fields.getTextInputValue(customId).trim();
      if (!value && required) {
        throw new PolyHelperError(`Could not get the "${customId}" text input. It was empty`);
      }
      return value || undefined;
    } catch (error) {
      if (error instanceof PolyHelperError) throw error;
      if (required) throw new PolyHelperError(`Could not get the "${customId}" text input`);
      return undefined;
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

  protected getSelectedRole(interaction: ModalSubmitInteraction, customId: string, required: false): string | undefined;
  protected getSelectedRole(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getSelectedRole(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    const role = this.getSelectedRoles(interaction, customId)[0];
    if (!role && required) {
      throw new PolyHelperError(`Could not get the "${customId}" role. There were no selected roles`);
    }
    return role;
  }

  protected getCheckbox(interaction: ModalSubmitInteraction, customId: string, defaultValue: boolean = true): boolean {
    try {
      return interaction.fields.getCheckbox(customId);
    } catch {
      return defaultValue;
    }
  }

  protected getRadioGroup(interaction: ModalSubmitInteraction, customId: string, required: false): string | undefined;
  protected getRadioGroup(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getRadioGroup(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    try {
      const value = interaction.fields.getRadioGroup(customId) ?? undefined;
      if (!value && required) {
        throw new PolyHelperError(`Could not get the "${customId}" radio group. No value was selected`);
      }
      return value;
    } catch (error) {
      if (error instanceof PolyHelperError) throw error;
      if (required) throw new PolyHelperError(`Could not get the "${customId}" radio group`);
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

  protected getStringSelectValue(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: false
  ): string | undefined;
  protected getStringSelectValue(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getStringSelectValue(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    const value = this.getStringSelectValues(interaction, customId)[0];
    if (!value && required) {
      throw new PolyHelperError(`Could not get the "${customId}" select value. No value was selected`);
    }
    return value;
  }

  protected getSelectedUsers(interaction: ModalSubmitInteraction, customId: string): string[] {
    try {
      return interaction.fields.getSelectedUsers(customId, true).map((user) => user.id);
    } catch {
      return [];
    }
  }

  protected getSelectedUser(interaction: ModalSubmitInteraction, customId: string, required: false): string | undefined;
  protected getSelectedUser(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getSelectedUser(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    const user = this.getSelectedUsers(interaction, customId)[0];
    if (!user && required) {
      throw new PolyHelperError(`Could not get the "${customId}" user. There were no selected users`);
    }
    return user;
  }

  protected getSelectedChannels(interaction: ModalSubmitInteraction, customId: string): string[] {
    try {
      return interaction.fields.getSelectedChannels(customId, true).map((channel) => channel.id);
    } catch {
      return [];
    }
  }

  protected getSelectedChannel(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: false
  ): string | undefined;
  protected getSelectedChannel(interaction: ModalSubmitInteraction, customId: string, required?: true): string;
  protected getSelectedChannel(
    interaction: ModalSubmitInteraction,
    customId: string,
    required: boolean = false
  ): string | undefined {
    const channel = this.getSelectedChannels(interaction, customId)[0];
    if (!channel && required) {
      throw new PolyHelperError(`Could not get the "${customId}" channel. There were no selected channels`);
    }
    return channel;
  }
}

export default DiscordModal;
