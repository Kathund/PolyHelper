import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class CloseRequestAcceptButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('closeRequestAccept').setFlags(
    InteractionFlag.RequiresGuild
  );

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this close request?');
    const closeRequest = this.discord.application.database.getCloseRequest(id);
    if (!closeRequest) throw new PolyHelperError('Could not find this close request?');
    await interaction.followUp({
      embeds: [
        new EmbedHelper()
          .setTitle('Closing...')
          .setDescription(`Close request has been accepted by <@${interaction.user.id}>`)
      ]
    });
    await closeRequest.ticket.close({ reason: closeRequest.reason, executor: interaction.user });
  }
}

export default CloseRequestAcceptButton;
