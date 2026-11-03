import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import ms, { type StringValue } from 'ms';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { DatabaseCloseRequest } from '../../../../types/database.ts';

class CloseRequestCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('closerequest')
    .setDescription('Request to close a ticket')
    .addStringOption((option) => option.setName('reason').setDescription('The reason for closing the ticket'))
    .addStringOption((option) =>
      option.setName('auto-close').setDescription('The auto close time (e.g. 1d, 72h, 2w) Defaults to 3d')
    )
    .setCleanErrorTitle('close request this ticket')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to close request this ticket...' });

    /*
     * Converts `5` -> `5h`
     * This is done to mirror how the old tickets bot we used worked
     */
    const autoCloseTime = (interaction.options.getString('auto-close') ?? '3d')?.replace(/^(\d+)$/, '$1h');
    const autoCloseDuration = autoCloseTime ? ms(autoCloseTime as StringValue) : undefined;
    if (autoCloseTime && autoCloseDuration !== 0 && (!Number.isFinite(autoCloseDuration) || autoCloseDuration! < 0)) {
      throw new PolyHelperError('The auto-close time must be a valid duration greater than zero.');
    }

    const autoClose: DatabaseCloseRequest['autoClose'] =
      autoCloseDuration && autoCloseDuration > 0 ? Date.now() + autoCloseDuration : null;

    await this.getTicket(interaction).closeRequest({
      reason: this.getReason(interaction),
      executor: interaction.user,
      autoClose
    });
  }
}

export default CloseRequestCommand;
