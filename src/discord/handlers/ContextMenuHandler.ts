import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import { type ContextMenuCommandInteraction, MessageFlags } from 'discord.js';
import { InteractionResponse } from '../../types/discord.ts';
import { readdir } from 'node:fs/promises';
import type DiscordContextMenu from '../private/interactions/contextMenus/DiscordContextMenu.ts';

class ContextMenuHandler extends BasicInteractionHandler<
  ContextMenuCommandInteraction,
  DiscordContextMenu<ContextMenuCommandInteraction>
> {
  override getRawIdFromInteraction(interaction: ContextMenuCommandInteraction) {
    return `${interaction.commandType}:${interaction.commandName}`;
  }

  override async handleResponse(
    interaction: ContextMenuCommandInteraction,
    element: DiscordContextMenu<ContextMenuCommandInteraction>
  ) {
    if (element.metadata.response === InteractionResponse.None) return;
    await interaction.deferReply({
      flags: element.metadata.response === InteractionResponse.Ephemeral ? MessageFlags.Ephemeral : undefined
    });
  }

  override async loadElements() {
    this.elements.clear();
    const contextMenus = [];

    const buttonFiles = await readdir('./src/discord/contextMenus/', { recursive: true, encoding: 'utf-8' }).then(
      (files) => files.filter((file) => file.endsWith('.ts'))
    );
    for (const file of buttonFiles) {
      const contextMenu: DiscordContextMenu<ContextMenuCommandInteraction> = new (
        await import(`../contextMenus/${file}`)
      ).default(this.discord);
      if (contextMenu.metadata.name) {
        for (const metadata of [contextMenu.metadata, ...contextMenu.variations]) {
          contextMenus.push(metadata.toJSON());
          this.elements.set(`${metadata.toJSON().type}:${metadata.name}`, contextMenu);
        }
      }
    }
    console.discord(`Successfully loaded ${this.elements.size} context menu(s).`);
    return contextMenus;
  }
}

export default ContextMenuHandler;
