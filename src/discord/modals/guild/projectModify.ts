import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { BaseDatabaseItem, DatabaseProject } from '../../../types/database.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class ProejctModifyModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('projectModify')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const data: Omit<DatabaseProject, keyof BaseDatabaseItem> = {
      name: interaction.fields.getTextInputValue('name'),
      source: 'Discord Command',
      sourceUrl: this.getTextInputValue(interaction, 'sourceUrl')?.trim() || null,
      modrinthId: this.getTextInputValue(interaction, 'modrinthId')?.trim() || null,
      notes: this.getTextInputValue(interaction, 'notes')?.trim() || null
    };

    const [id] = this.getArgs(interaction);
    if (id === undefined) {
      const project = this.discord.application.database.insertProject(data);
      await interaction.followUp({ ...project.toMessageData(), content: `Project "${project.name}" created.` });
    } else {
      const project = this.discord.application.database.updateProject({ id, ...data });
      await interaction.followUp({ content: `Project "${project.name}" updated.` });
    }
  }
}

export default ProejctModifyModal;
