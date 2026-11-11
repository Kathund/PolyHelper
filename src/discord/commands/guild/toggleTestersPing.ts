import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { SuccessEmbed } from '../../private/EmbedHelper.ts';
import { hasRole } from '../../../utils/discordUtils.ts';
import type { ChatInputCommandInteraction } from 'discord.js';

class ToggleTicketPingCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('toggle-testers-ping')
    .setDescription("Toggle the tester's ping role")
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Ephemeral);

  override async execute(interaction: InteractionWithGuild<ChatInputCommandInteraction>) {
    if (interaction.channel.id !== this.discord.application.config.discord.channels.testersChat) {
      throw new PolyHelperError(
        'Please run this command in the testing-chat channel. If you cannot access that channel, you do not have permission to execute this command.'
      );
    }

    const has = await hasRole(interaction.member, this.discord.application.config.discord.roles.testerPing);
    if (has) await interaction.member.roles.remove(this.discord.application.config.discord.roles.testerPing);
    else await interaction.member.roles.add(this.discord.application.config.discord.roles.testerPing);

    await interaction.followUp({
      embeds: [
        new SuccessEmbed().setDescription(
          has
            ? 'You will **no longer be mentioned** for testing related stuff.'
            : 'You will **now be mentioned** for testing related stuff.'
        )
      ]
    });
  }
}

export default ToggleTicketPingCommand;
