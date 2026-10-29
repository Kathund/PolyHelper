import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { SupportTeamPanel } from '../../../private/ComponentHelper.ts';
import type { ButtonInteraction } from 'discord.js';

class EditSupportTeamButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('editSupportTeam')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this support team?');
    const supportTeam = this.discord.application.database.getSupportTeam(id);
    if (!supportTeam) throw new PolyHelperError('Could not find the matching support team?');
    await interaction.showModal(
      SupportTeamPanel(supportTeam).setCustomId(`supportTeamModify:${id}`).setTitle('Editing a support team')
    );
  }
}

export default EditSupportTeamButton;
