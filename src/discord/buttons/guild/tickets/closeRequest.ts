import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, type InteractionWithGuild } from '../../../../types/discord.ts';
import { isSupportMember } from '../../../../utils/discordUtils.ts';
import type { ButtonInteraction } from 'discord.js';

class CloseRequestAcceptButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('closeRequest').setFlags(
    InteractionFlag.RequiresGuild
  );

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [action, id] = this.getArgs(interaction);
    if (action === undefined) throw new PolyHelperError('This close request is missing the action type?');
    if (id === undefined) throw new PolyHelperError('Could not find this close request?');
    const closeRequest = this.discord.application.database.getCloseRequest(id);
    if (!closeRequest) throw new PolyHelperError('Could not find this close request?');

    const isSupportTeam = await isSupportMember(interaction.member);
    if (closeRequest.ticket.owner !== interaction.user.id && !isSupportTeam) {
      throw new PolyHelperError('Close requests can only be interacted with by the ticket owner or the support team');
    }

    await closeRequest.updateMessageButtons(true);

    if (action === 'accept') {
      await interaction.followUp({
        embeds: [
          new EmbedHelper()
            .setTitle('Closing...')
            .setDescription(`Close request has been accepted by <@${interaction.user.id}>`)
        ]
      });
      await closeRequest.ticket.close({ reason: closeRequest.reason, executor: interaction.user });
    } else if (action === 'deny') {
      await interaction.followUp({
        embeds: [
          new EmbedHelper()
            .setColor('Red')
            .setTitle('Close Request')
            .setDescription(`Close request has been denied by <@${interaction.user.id}>`)
        ]
      });
      await this.discord.application.database.deleteCloseRequest(closeRequest.id);
    } else {
      throw new PolyHelperError('Invalid close request type found?');
    }
  }
}

export default CloseRequestAcceptButton;
