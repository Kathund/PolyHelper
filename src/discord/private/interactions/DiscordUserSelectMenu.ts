import BasicInteractionData from './basic/BasicInteractionData.ts';
import type { UserSelectMenuInteraction } from 'discord.js';

abstract class DiscordUserSelectMenu extends BasicInteractionData<UserSelectMenuInteraction> {}

export default DiscordUserSelectMenu;
