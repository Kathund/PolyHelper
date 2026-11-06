import DiscordCommand from '../../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import {
  InteractionFlag,
  InteractionPermission,
  InteractionResponse,
  type InteractionWithGuild
} from '../../../../types/discord.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class TicketBlacklistCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('ticket-blacklist')
    .addSubcommand((option) =>
      option
        .setName('view')
        .setDescription('View information for a ticket blacklist')
        .addUserOption((option) => option.setName('user').setDescription('The user you want to view').setRequired(true))
    )
    .addSubcommand((option) =>
      option
        .setName('add')
        .setDescription('add a user to the ticket blacklist')
        .addUserOption((option) => option.setName('user').setDescription('The user you want to add').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('The reason to log'))
    )
    .addSubcommand((option) =>
      option
        .setName('remove')
        .setDescription('add a user to the ticket blacklist')
        .addUserOption((option) => option.setName('user').setDescription('The user you want to add').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('The reason to log'))
    )
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Moderator);

  async executeView(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const user = interaction.options.getUser('user', true);
    const blacklist = this.discord.application.database.getTicketBlacklistUserByUser(user.id);
    if (!blacklist) throw new PolyHelperError('User is not blacklisted');
    await interaction.followUp(blacklist.toMessageData());
  }

  async executeAdd(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const user = interaction.options.getUser('user', true);
    const blacklist = this.discord.application.database.getTicketBlacklistUserByUser(user.id);
    if (blacklist?.active) throw new PolyHelperError('User already blacklisted');
    const updated = await this.discord.application.database.insertTicketBlacklistUser({
      user: user.id,
      reason: this.getReason(interaction),
      addedBy: interaction.user.id
    });
    const message = await updated.getLogMessage();
    await interaction.followUp({ content: `Blacklist added. ${message?.url ?? ''}`.trim() });
  }

  async executeRemove(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    const user = interaction.options.getUser('user', true);
    const blacklist = this.discord.application.database.getTicketBlacklistUserByUser(user.id);
    if (!blacklist?.active) throw new PolyHelperError("User isn't blacklisted");
    const updated = await this.discord.application.database.removeTicketBlacklistUser({
      id: blacklist.id,
      removedReason: this.getReason(interaction),
      removedBy: interaction.user.id
    });
    const message = await updated.getLogMessage();
    await interaction.followUp({ content: `Blacklist Removed. ${message?.url ?? ''}`.trim() });
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default TicketBlacklistCommand;
