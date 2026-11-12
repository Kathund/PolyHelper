import Application from '../../../Application.ts';
import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  ActionRowBuilder,
  type ModalMessageModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../types/discord.ts';
import { createIssue } from '../../../utils/githubUtils.ts';

class CreateIssueModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('createIssue')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.SuperContributor);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const possibleProjects = this.discord.application.database.searchProjectNames(
      interaction.fields.getTextInputValue('project')
    );
    if (possibleProjects.length === 0) {
      throw new PolyHelperError('Could not find any possible projects from your input');
    }

    const data = {
      title: interaction.fields.getTextInputValue('title'),
      description: this.getTextInputValue(interaction, 'description')?.trim() || undefined
    };
    const id = crypto.randomUUID();
    Application.cache.set(`createIssue:input:${id}`, data);

    if (possibleProjects.length === 1 && possibleProjects[0] !== undefined) {
      const project = this.discord.application.database.getProject(possibleProjects[0].id);
      if (!project) throw new PolyHelperError('Does this project exist?');
      const ghData = project.getGithubMetadata();
      if (!ghData) throw new PolyHelperError("This project is either not on github or doesn't have public source code");
      const issue = await createIssue({ ...ghData, ...data, author: interaction.user });
      if (!issue) throw new PolyHelperError('Something went wrong while creating this issue');
      return await interaction.followUp({ content: `Issue created - <${issue.html_url}>` });
    }

    await interaction.followUp({
      content: '# Select the project',
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`selectIssue:${id}`)
            .setPlaceholder('Select a project')
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
              possibleProjects
                .slice(0, 25)
                .map((project) => new StringSelectMenuOptionBuilder().setLabel(project.name).setValue(project.id))
            )
        )
      ]
    });
  }
}

export default CreateIssueModal;
