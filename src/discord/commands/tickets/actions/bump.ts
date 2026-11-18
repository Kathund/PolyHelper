import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper from '../../../private/EmbedHelper.ts';
import PolyHelperError from '../../../../private/error.ts';
import { InteractionPermission, type InteractionWithGuild } from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class BumpCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('bump')
    .setDescription('Bumps a ticket to encourage closing')
    .setCleanErrorTitle('bump this ticket')
    .setPermission(InteractionPermission.Support)
    .removeHidddenOption();

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const ticket = this.getTicket(interaction);
    if (ticket.pinned) throw new PolyHelperError('This ticket is pinned. Please unpin it before bumping');
    await interaction.followUp({
      content: `Hey <@${ticket.owner}>:`,
      embeds: [
        new EmbedHelper()
          .setColor('Yellow')
          .setTitle('Do you still need help?')
          .setFields(
            {
              name: '> Yes, I still need help!',
              value: '__Restate your problem clearly.__ If someone asked you to upload something, do that.'
            },
            { name: '> No, all my problems are solved.', value: '__Let us know__ so we can close the ticket.' }
          )
      ],
      allowedMentions: { users: [ticket.owner] }
    });
  }
}

export default BumpCommand;
