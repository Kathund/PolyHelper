import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../../../types/discord.ts';
import type Ticket from '../../../../database/private/Ticket.ts';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';

class OpenCommand extends DiscordCommand {
  override readonly metadata = new DiscordCommandMetadata()
    .setName('open')
    .setDescription('Open a closed ticket')
    .addStringOption((option) => option.setName('reason').setDescription('The reason for opening the ticket'))
    .addStringOption((option) =>
      option.setName('closed-ticket-id').setDescription('The ticket id that you want to reopen').setAutocomplete(true)
    )
    .setCleanErrorTitle('open ticket')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override getTicket(interaction: InteractionWithGuild<ChatInputCommandInteraction<CacheType>>): Ticket {
    const ticketId = interaction.options.getString('closed-ticket-id');
    if (!ticketId) return super.getTicket(interaction);
    const ticket = this.discord.application.database.getTicket(ticketId);
    if (ticket) return ticket;
    return super.getTicket(interaction);
  }

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    await interaction.followUp({ content: 'Attempting to open this ticket...' });
    await this.getTicket(interaction).open({ reason: this.getReason(interaction), executor: interaction.user });
  }
}

export default OpenCommand;
