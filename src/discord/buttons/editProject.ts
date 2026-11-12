import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { ProjectModal } from '../private/ComponentHelper.ts';
import type { ButtonInteraction } from 'discord.js';

class EditProjectButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('editProject')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: ButtonInteraction) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this project?');
    const project = this.discord.application.database.getProject(id);
    if (!project) throw new PolyHelperError('Could not find the matching project?');
    await interaction.showModal(ProjectModal(project).setCustomId(`projectModify:${id}`).setTitle('Editing a Project'));
  }
}

export default EditProjectButton;
