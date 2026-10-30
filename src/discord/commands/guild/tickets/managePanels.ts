import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import { BasicPanelModal } from '../../../private/ComponentHelper.ts';
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';

class ManagePanelsCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('manage-panels')
    .addSubcommand((option) => option.setName('add').setDescription('add a panel'))
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('view a panel')
        .addStringOption((option) =>
          option.setName('panel-id').setDescription('the panel id').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((option) =>
      option
        .setName('remove')
        .setDescription('remove a panel')
        .addStringOption((option) =>
          option.setName('panel-id').setDescription('the panel id').setRequired(true).setAutocomplete(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setResponse(InteractionResponse.None)
    .setFlags(InteractionFlag.RequiresGuild)
    .setFetchGuildMember(false);

  async executeAdd(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.showModal(BasicPanelModal().setCustomId('panelModify').setTitle('Adding a new Panel'));
  }

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('panel-id', true);
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    await interaction.followUp(panel.toMessageData());
  }

  async executeRemove(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('panel-id', true);
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    await this.discord.application.database.deletePanel(id);
    await interaction.followUp({ content: `Panel "${panel.name}" deleted.` });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default ManagePanelsCommand;
