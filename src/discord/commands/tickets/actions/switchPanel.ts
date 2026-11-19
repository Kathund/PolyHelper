import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class SwitchPanelCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('switchpanel')
    .setDescription('Switch the panel of a ticket')
    .addStringOption((option) =>
      option.setName('same-group-panel-id').setDescription('the new panel').setAutocomplete(true).setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('The reason for switching the panel'))
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to switch panel...' });
    const id = interaction.options.getString('same-group-panel-id', true);
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    await this.getTicket(interaction).switchPanel({
      executor: interaction.user,
      reason: this.getReason(interaction),
      panel
    });
  }
}

export default SwitchPanelCommand;
