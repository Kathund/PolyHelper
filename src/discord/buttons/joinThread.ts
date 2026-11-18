import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordButton from '../private/interactions/DiscordButton.ts';
import PolyHelperError from '../../private/error.ts';
import { type ButtonInteraction, ChannelType } from 'discord.js';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../types/discord.ts';
import { SuccessEmbed } from '../private/EmbedHelper.ts';

class JoinThreadButton extends DiscordButton {
  override readonly metadata = new BasicInteractionMetadata('joinThread')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<ButtonInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find this thread?');
    const thread = await interaction.guild.channels.fetch(id);
    if (!thread || thread.type !== ChannelType.PrivateThread) throw new PolyHelperError('Could not find this thread?');
    await thread.members.add(interaction.user.id);
    await interaction.followUp({
      embeds: [
        new SuccessEmbed().setDescription('Added you to this thread').setFields({ name: 'Thread', value: `<#${id}>` })
      ]
    });
  }
}

export default JoinThreadButton;
