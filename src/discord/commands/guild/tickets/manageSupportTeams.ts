import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { SupportTeamPanel } from '../../../private/ComponentHelper.ts';

class ManageSupportTeamsCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('manage-support-teams')
    .addSubcommand((option) => option.setName('add').setDescription('add a support team'))
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('view a support team')
        .addStringOption((option) =>
          option
            .setName('support-team-id')
            .setDescription('the support team id')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((option) =>
      option
        .setName('edit')
        .setDescription('edit a support team')
        .addStringOption((option) =>
          option
            .setName('support-team-id')
            .setDescription('the support team id')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((option) =>
      option
        .setName('remove')
        .setDescription('remove a support team')
        .addStringOption((option) =>
          option
            .setName('support-team-id')
            .setDescription('the support team id')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setResponse(InteractionResponse.None)
    .setFlags(InteractionFlag.RequiresGuild)
    .setFetchGuildMember(false);

  async executeAdd(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.showModal(SupportTeamPanel().setCustomId('supportTeamModify').setTitle('Add a new support team'));
  }

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('support-team-id', true);
    const supportTeam = this.discord.application.database.getSupportTeam(id);
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');
    await interaction.followUp(supportTeam.getMessageData());
  }

  async executeEdit(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const id = interaction.options.getString('support-team-id', true);
    const supportTeam = this.discord.application.database.getSupportTeam(id);
    if (!supportTeam) return await interaction.followUp({ content: "This support team doesn't exist" });
    await interaction.showModal(
      SupportTeamPanel(supportTeam).setCustomId(`supportTeamModify:${id}`).setTitle('Editing a support team')
    );
  }

  async executeRemove(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('support-team-id', true);
    const supportTeam = this.discord.application.database.getSupportTeam(id);
    if (!supportTeam) throw new PolyHelperError('Could not find this support team?');
    await this.discord.application.database.deleteSupportTeam(id);
    await interaction.followUp({ content: `Support Team "${supportTeam.name}" deleted.` });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default ManageSupportTeamsCommand;
