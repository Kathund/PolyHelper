import DiscordCommand from '../../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../../private/interactions/commands/DiscordCommandMetadata.ts';
import EmbedHelper, { SuccessEmbed } from '../../private/EmbedHelper.ts';
import PolyHelperError from '../../../private/error.ts';
import { type ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import { InteractionPermission } from '../../../types/discord.ts';
import { titleCase } from '../../../utils/stringUtils.ts';

class RuntimeSettingsCommand extends DiscordCommand {
  private createSubcommandGroup(optionName: string): SlashCommandSubcommandGroupBuilder {
    return new SlashCommandSubcommandGroupBuilder()
      .setName(optionName)
      .setDescription(optionName)
      .addSubcommand((option) => option.setName('get').setDescription(`Get the value of ${optionName}`))
      .addSubcommand((option) => option.setName('delete').setDescription(`Delete the value of ${optionName}`))
      .addSubcommand((option) =>
        option
          .setName('set')
          .setDescription(`Set the value of ${optionName}`)
          .addStringOption((option) =>
            option.setName('value').setDescription('The value you want it to be').setRequired(true)
          )
      );
  }

  override readonly metadata = new DiscordCommandMetadata()
    .setName('runtime-settings')
    .addSubcommandGroup(this.createSubcommandGroup('panels-message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setPermission(InteractionPermission.Owner);

  async executeGet(interaction: ChatInputCommandInteraction) {
    const entryName = interaction.options.getSubcommandGroup(true);
    const data = this.discord.application.database.getMetadataEntry(entryName);
    await interaction.followUp({
      embeds: [
        new EmbedHelper()
          .setTitle(titleCase(entryName))
          .setFields(
            { name: 'Key', value: data?.key ?? 'undefined', format: 'Block' },
            { name: 'Value', value: data?.value ?? 'undefined', format: 'Block' }
          )
      ]
    });
  }

  async executeDelete(interaction: ChatInputCommandInteraction) {
    const entryName = interaction.options.getSubcommandGroup(true);
    const data = this.discord.application.database.getMetadataEntry(entryName);
    if (!data) return await interaction.followUp({ content: "This metadata entry doesn't exist for some reason" });
    this.discord.application.database.deleteMetadataEntry(entryName);
    await interaction.followUp({ embeds: [new SuccessEmbed().setDescription('Deleted')] });
  }

  async executeSet(interaction: ChatInputCommandInteraction) {
    const entryName = interaction.options.getSubcommandGroup(true);
    const data = this.discord.application.database.getMetadataEntry(entryName);
    if (!data) return await interaction.followUp({ content: "This metadata entry doesn't exist for some reason" });
    this.discord.application.database.setMetadataEntry({
      key: entryName,
      value: interaction.options.getString('value', true)
    });
    await this.executeGet(interaction);
  }

  override execute(interaction: ChatInputCommandInteraction): Promise<any> {
    throw new PolyHelperError('Invalid subcommand found');
  }
}

export default RuntimeSettingsCommand;
