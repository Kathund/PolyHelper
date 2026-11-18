import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  BasicPanelModal,
  ButtonOptionsPanelModal,
  MiscPanelModal,
  SupportTeamPanelModal,
  TicketOpenOptionsPanelModal
} from '../../private/ComponentHelper.ts';
import { InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { ButtonInteraction, ModalBuilder } from 'discord.js';

class PanelModifyButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('panelModify')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  private getPanelModal(interaction: ButtonInteraction): ModalBuilder {
    const [id, type] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel?');
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    if (type === 'basic') {
      return BasicPanelModal(this.discord.application.database.getPanelGroups(), panel).setTitle(
        'Editing the Basic Information'
      );
    } else if (type === 'supportTeam') {
      return SupportTeamPanelModal(this.discord.application.database.getSupportTeams(), panel).setTitle(
        'Editing the Support Team'
      );
    } else if (type === 'button') {
      return ButtonOptionsPanelModal(panel).setTitle('Editing the Button');
    } else if (type === 'opening') {
      return TicketOpenOptionsPanelModal(panel).setTitle('Editing the Opening Options');
    } else if (type === 'misc') {
      return MiscPanelModal(panel).setTitle('Editing the Misc Information');
    }
    throw new PolyHelperError('Invalid Panel edit type');
  }

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    await interaction.showModal(this.getPanelModal(interaction).setCustomId(interaction.customId));
  }
}

export default PanelModifyButton;
