import Application from '../../Application.ts';
import DiscordCommand from '../private/interactions/commands/DiscordCommand.ts';
import DiscordCommandMetadata from '../private/interactions/commands/DiscordCommandMetadata.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  TextDisplayBuilder
} from 'discord.js';
import { PatchedContainerBuilder, ViewCreditsButton, ViewSourceCodeButton } from '../private/ComponentHelper.ts';

class InformationCommand extends DiscordCommand {
  override readonly metadata: DiscordCommandMetadata = new DiscordCommandMetadata()
    .setName('information')
    .setDescription('Shows information about the bot.');

  private static formatInformation({
    name,
    value,
    format
  }: {
    name: string;
    value: string | number;
    format?: boolean;
  }): string {
    return `**${name}:** ${format !== false ? `\`${value}\`` : value}`;
  }

  static InformationComponent(ownerId: string): NonNullable<BaseMessageOptions['components']> {
    const { commit, dirty, startTime, docker } = Application.getRuntimeInformation();
    return [
      new PatchedContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# ${Application.package.name}`),
          new TextDisplayBuilder().setContent(Application.package.description)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              '## Runtime Info',
              ...[
                { name: 'Version', value: Application.package.version },
                { name: 'Online since', value: `<t:${startTime}:F> (<t:${startTime}:R>)`, format: false },
                { name: 'Git Hash', value: commit ?? 'UNKNOWN' },
                {
                  name: 'Is Git Dirty',
                  value: dirty !== null ? (dirty ? ':white_check_mark: Yes' : ':x: No') : 'UNKNOWN',
                  format: false
                },
                {
                  name: 'Is Inside of Docker Container',
                  value: docker ? ':white_check_mark: Yes' : ':x: No',
                  format: false
                }
              ].map((line) => this.formatInformation(line))
            ].join('\n')
          )
        ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(ViewCreditsButton(ownerId), ViewSourceCodeButton())
    ];
  }

  override async execute(interaction: ChatInputCommandInteraction) {
    await interaction.followUp({
      components: InformationCommand.InformationComponent(interaction.user.id),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
  }
}

export default InformationCommand;
