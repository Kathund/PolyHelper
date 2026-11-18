import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { PanelGroupModal } from '../../private/ComponentHelper.ts';
import type { ButtonInteraction } from 'discord.js';

class EditPanelGroupButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('editPanelGroup')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel group?');
    const panelGroup = this.discord.application.database.getPanelGroup(id);
    if (!panelGroup) throw new PolyHelperError('Could not find the matching panel group?');
    await interaction.showModal(
      PanelGroupModal(panelGroup).setCustomId(`panelGroupModify:${id}`).setTitle('Editing a panel group')
    );
  }
}

export default EditPanelGroupButton;
