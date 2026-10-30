import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import type { DatabaseSupportTeam } from '../../../types/database.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class SupportTeamModifyModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('supportTeamModify')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const data: Omit<DatabaseSupportTeam, 'id'> = {
      name: interaction.fields.getTextInputValue('name'),
      supportRole: this.getSelectedRole(interaction, 'supportRole'),
      ticketPingRole: this.getSelectedRole(interaction, 'ticketPingRole')
    };

    const [id] = this.getArgs(interaction);
    if (id === undefined) {
      const supportTeam = this.discord.application.database.insertSupportTeam(data);
      await interaction.followUp({
        ...supportTeam.toMessageData(),
        content: `Support Team "${supportTeam.name}" created.`
      });
    } else {
      const supportTeam = this.discord.application.database.updateSupportTeam({ id, ...data });
      await interaction.followUp({ content: `Support Team "${supportTeam.name}" updated.` });
    }
  }
}

export default SupportTeamModifyModal;
