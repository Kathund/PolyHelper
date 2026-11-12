import Application from '../../Application.ts';
import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionResponse } from '../../types/discord.ts';
import { createIssue } from '../../utils/githubUtils.ts';
import type { CreateIssueOptions } from '../../types/github.ts';
import type { StringSelectMenuInteraction } from 'discord.js';

class SelectIssue extends DiscordStringSelectMenu {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('selectIssue')
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: StringSelectMenuInteraction) {
    const [id] = this.getArgs(interaction);
    if (!id) throw new PolyHelperError('Could not find the id for this create issue');
    const data = Application.cache.get<Pick<CreateIssueOptions, 'title' | 'description'>>(`createIssue:input:${id}`);
    if (!data) throw new PolyHelperError('This create issue has expired. Please run it again');

    const value = interaction.values[0];
    if (value === undefined) throw new PolyHelperError(`Could not get the "${value}" project`);
    const project = this.discord.application.database.getProject(value);
    if (!project) throw new PolyHelperError(`Could not get the "${value}" project`);
    const ghData = project.getGithubMetadata();
    if (!ghData) throw new PolyHelperError("This project is either not on github or doesn't have public source code");
    const issue = await createIssue({ ...ghData, ...data, author: interaction.user });
    if (!issue) throw new PolyHelperError('Something went wrong while creating this issue');
    await interaction.editReply({ content: `Issue created - <${issue.html_url}>`, components: [] });
  }
}

export default SelectIssue;
