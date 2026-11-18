import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../private/error.ts';
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { PanelGroupModal } from '../../private/ComponentHelper.ts';

class ManagePanelGroupsCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('manage-panel-groups')
    .addSubcommand((option) => option.setName('add').setDescription('add a panel group'))
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('view a panel group')
        .addStringOption((option) =>
          option.setName('panel-group-id').setDescription('the panel group id').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((option) =>
      option
        .setName('remove')
        .setDescription('remove a panel group')
        .addStringOption((option) =>
          option.setName('panel-group-id').setDescription('the panel group id').setRequired(true).setAutocomplete(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  async executeAdd(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.showModal(PanelGroupModal().setCustomId('panelGroupModify').setTitle('Adding a new Panel Group'));
  }

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('panel-group-id', true);
    const panelGroup = this.discord.application.database.getPanelGroup(id);
    if (!panelGroup) throw new PolyHelperError('Could not find this panel group?');
    await interaction.followUp(panelGroup.toMessageData());
  }

  async executeRemove(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('panel-group-id', true);
    const panel = this.discord.application.database.getPanelGroup(id);
    if (!panel) throw new PolyHelperError('Could not find this panel group?');
    this.discord.application.database.deletePanelGroup(id);
    await interaction.followUp({ content: `Panel "${panel.name}" deleted.` });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default ManagePanelGroupsCommand;
