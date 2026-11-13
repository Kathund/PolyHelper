import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionFlag, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ButtonInteraction } from 'discord.js';

class CloseRequestOldButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata([
    'closeRequestAccept',
    'closeRequestDeny'
  ]).setFlags(InteractionFlag.RequiresGuild);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this close request?');
    const closeRequest = this.discord.application.database.getCloseRequest(id);
    if (!closeRequest) throw new PolyHelperError('Could not find this close request?');

    await closeRequest.updateMessageButtons();
    await interaction.reply({
      content: 'Close Request migrated to the new system. Please interact with the buttons again'
    });
  }
}

export default CloseRequestOldButton;
