import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import CreditsCommand from '../commands/credits.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import {
  type ButtonInteraction,
  type InteractionReplyOptions,
  type MessageEditOptions,
  MessageFlags
} from 'discord.js';
import { InteractionResponse } from '../../types/discord.ts';

class ViewCreditsButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('viewCredits')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: ButtonInteraction) {
    const [ownerId] = this.getArgs(interaction);
    const message: MessageEditOptions & InteractionReplyOptions = {
      components: CreditsCommand.CreditsComponent(interaction.user.id),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    };
    if (ownerId === interaction.user.id) await interaction.update(message);
    else await interaction.reply(message);
  }
}

export default ViewCreditsButton;
