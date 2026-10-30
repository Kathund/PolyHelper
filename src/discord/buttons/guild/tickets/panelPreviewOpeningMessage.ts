import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';

class PanelPreviewOpeningMessageButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('panelPreviewOpeningMessage')
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id, response] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this panel?');
    const panel = this.discord.application.database.getPanel(id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    const message: BaseMessageOptions = {
      ...panel.getStartingMessageData(interaction.user),
      components: [
        new ActionRowBuilder<ButtonBuilder>().setComponents(
          new ButtonBuilder()
            .setCustomId(`panelPreviewOpeningMessage:${id}:update`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    };
    if (response === 'update') await interaction.update(message);
    else await interaction.reply({ ...message, flags: MessageFlags.Ephemeral });
  }
}

export default PanelPreviewOpeningMessageButton;
