import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../private/error.ts';
import { type ChatInputCommandInteraction } from 'discord.js';
import { InteractionFlag, InteractionPermission } from '../../../types/discord.ts';
import { createIssue } from '../../../utils/githubUtils.ts';

class CreateIssueCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('create-issue')
    .setDescription('create an issue on a project')
    .addStringOption((option) =>
      option
        .setName('project-with-gh')
        .setDescription('The project you wanna create the issue on')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) => option.setName('title').setDescription('The title of the issue').setRequired(true))
    .addStringOption((option) => option.setName('description').setDescription('The description of the issue'))
    .setPermission(InteractionPermission.SuperContributor)
    .setFlags(InteractionFlag.RequiresGuild);

  override async execute(interaction: ChatInputCommandInteraction) {
    const project = this.discord.application.database.getProject(
      interaction.options.getString('project-with-gh', true)
    );
    if (!project) throw new PolyHelperError('Does this project exist?');
    const ghData = project.getGithubMetadata();
    if (!ghData) throw new PolyHelperError("This project is either not on github or doesn't have public source code");

    const issue = await createIssue({
      ...ghData,
      title: interaction.options.getString('title', true),
      description: interaction.options.getString('description') ?? undefined,
      author: interaction.user
    });
    if (!issue) throw new PolyHelperError('Something went wrong while creating this issue');
    await interaction.followUp({ content: `Issue created - <${issue.html_url}>` });
  }
}

export default CreateIssueCommand;
