import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../private/error.ts';
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { ProjectModal } from '../../private/ComponentHelper.ts';

class ManageProjectsCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('manage-projects')
    .addSubcommand((option) => option.setName('add').setDescription('add a project'))
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('view a project')
        .addStringOption((option) =>
          option.setName('project').setDescription('the project id').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((option) =>
      option
        .setName('remove')
        .setDescription('remove a project')
        .addStringOption((option) =>
          option.setName('project').setDescription('the project id').setRequired(true).setAutocomplete(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setResponse(InteractionResponse.None)
    .setFlags(InteractionFlag.RequiresGuild)
    .setFetchGuildMember(false);

  async executeAdd(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.showModal(ProjectModal().setCustomId('projectModify').setTitle('Adding a new Project'));
  }

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('project', true);
    const project = this.discord.application.database.getProject(id);
    if (!project) throw new PolyHelperError('Could not find this project?');
    await interaction.followUp(project.toMessageData());
  }

  async executeRemove(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('project', true);
    const project = this.discord.application.database.getProject(id);
    if (!project) throw new PolyHelperError('Could not find this project?');
    this.discord.application.database.deleteProject(id);
    await interaction.followUp({ content: `Project "${project.name}" deleted.` });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default ManageProjectsCommand;
