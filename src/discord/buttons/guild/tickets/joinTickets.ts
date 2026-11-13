import BasicInteractionMetadata from '../../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../../../private/interactions/DiscordButton.ts';
import EmbedHelper, { SuccessEmbed } from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import { AttachmentBuilder, type ButtonInteraction, ComponentType, MessageFlags } from 'discord.js';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import { toError } from '../../../../utils/miscUtils.ts';

class JoinTicketsButton extends DiscordButton {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('joinTickets')
    .setFlags(InteractionFlag.RequiresGuild)
    .setPermission(InteractionPermission.Support)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const stringSelect = interaction.message.components
      .filter((compontent) => compontent.type === ComponentType.ActionRow)
      .flatMap((compontent) => compontent.components)
      .filter((compontent) => compontent.type === ComponentType.StringSelect)
      .find((compontent) => compontent.customId === 'ticketsSearch');
    if (!stringSelect) throw new PolyHelperError('Could not find the list of ticket ids');
    const ticketIds = stringSelect.data.options.map((option) => option.value).filter((id) => id !== 'nothing');
    if (ticketIds.length === 0) throw new PolyHelperError('No ticket ids found');
    await interaction.followUp({
      embeds: [new EmbedHelper().setDescription(`Adding you to ${ticketIds.length} ticket(s)`)]
    });
    const errorMap: Record<string, string> = {};
    for (const ticketId of ticketIds) {
      const ticket = this.discord.application.database.getTicket(ticketId);
      if (!ticket) {
        errorMap[ticketId] = 'Could not find this ticket';
        continue;
      }
      await ticket
        .addUser({ user: interaction.user, executor: interaction.user, silent: true })
        .catch((e) => (errorMap[ticketId] = toError(e).message));
    }
    await interaction.followUp({
      embeds: [
        new SuccessEmbed().setDescription(
          `Added you to ${ticketIds.length - Object.keys(errorMap).length}/${ticketIds.length} ticket(s)`
        )
      ],
      files:
        Object.keys(errorMap).length === 0
          ? []
          : [new AttachmentBuilder(Buffer.from(JSON.stringify(errorMap, null, 2), 'utf8'), { name: 'errors.json' })],
      flags: MessageFlags.Ephemeral
    });
  }
}

export default JoinTicketsButton;
