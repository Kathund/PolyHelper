import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ButtonInteraction, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import { getReason, titleCaseFromCamel } from '../../../../utils/stringUtils.ts';

class TicketStateUpdateButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata([
    'reopenTicket',
    'closeTicket',
    'unpinTicket',
    'pinTicket'
  ])
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this ticket?');
    const ticket = this.discord.application.database.getTicket(id);
    if (!ticket) throw new PolyHelperError('Could not find this ticket?');
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle(titleCaseFromCamel(this.getRawId(interaction)))
        .addLabelComponents(
          new LabelBuilder()
            .setLabel('Reason')
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId('reason')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(getReason())
            )
        )
    );
  }
}

export default TicketStateUpdateButton;
