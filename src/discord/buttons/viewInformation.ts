import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import InformationCommand from '../commands/information.ts';
import {
  type ButtonInteraction,
  type InteractionReplyOptions,
  type MessageEditOptions,
  MessageFlags
} from 'discord.js';
import { InteractionResponse } from '../../types/discord.ts';

class ViewInformationButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('viewInformation')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: ButtonInteraction) {
    const [ownerId] = this.getArgs(interaction);
    const message: MessageEditOptions & InteractionReplyOptions = {
      components: InformationCommand.InformationComponent(interaction.user.id),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    };
    if (ownerId === interaction.user.id) await interaction.update(message);
    else await interaction.reply(message);
  }
}

export default ViewInformationButton;
