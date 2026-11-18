import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class RefreshPanelGroupMessageButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('refreshPanelGroupMessage')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel group?');
    const panelGroup = this.discord.application.database.getPanelGroup(id);
    if (!panelGroup) throw new PolyHelperError('Could not find the matching panel group?');
    const message = await panelGroup.updateMessage();
    await interaction.followUp({ content: `Updated - ${message.url}` });
  }
}

export default RefreshPanelGroupMessageButton;
