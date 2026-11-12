import Application from '../../../../Application.ts';
import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../../../private/error.ts';
import { type ButtonInteraction, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { TicketSearch } from '../../../../types/misc.ts';

class TicketSearchFilterTaggedProjectButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilterTaggedProject')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.None)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get<TicketSearch>(`ticket:search:${id}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');
    await interaction.showModal(
      new ModalBuilder()
        .setTitle('Project Name')
        .setCustomId(interaction.customId)
        .addLabelComponents(
          new LabelBuilder().setLabel('project').setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('project')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(this.discord.application.database.getProject(filters.taggedProjectId ?? '')?.name ?? '')
          )
        )
    );
  }
}

export default TicketSearchFilterTaggedProjectButton;
