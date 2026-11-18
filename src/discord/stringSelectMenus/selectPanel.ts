import BasicInteractionMetadata from '../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordStringSelectMenu from '../private/interactions/DiscordStringSelectMenu.ts';
import PolyHelperError from '../../private/error.ts';
import { InteractionPermission, InteractionResponse, type InteractionWithGuild } from '../../types/discord.ts';
import type { StringSelectMenuInteraction } from 'discord.js';

class SelectPanel extends DiscordStringSelectMenu {
  override readonly metadata = new BasicInteractionMetadata('selectPanel')
    .setResponse(InteractionResponse.Ephemeral)
    .setPermission(InteractionPermission.Support);

  override async execute(interaction: InteractionWithGuild<StringSelectMenuInteraction>) {
    const value = interaction.values[0];
    if (value === undefined) throw new PolyHelperError(`Could not get the "${value}" panel`);
    const panel = this.discord.application.database.getPanel(value);
    if (!panel) throw new PolyHelperError(`Could not get the "${value}" panel`);
    await interaction.followUp(panel.toMessageData());
  }
}

export default SelectPanel;
