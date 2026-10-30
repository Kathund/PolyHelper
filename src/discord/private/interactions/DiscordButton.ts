import BasicInteractionData from './basic/BasicInteractionData.ts';
import PolyHelperError from '../../../private/error.ts';
import type BaseParsedDatabaseItem from '../../../database/private/BaseParsedDatabaseItem.ts';
import type { ButtonInteraction } from 'discord.js';
import type { DatabaseItem } from '../../../types/database.ts';

abstract class DiscordButton extends BasicInteractionData<ButtonInteraction> {
  protected getDatabaseData(interaction: ButtonInteraction): BaseParsedDatabaseItem<DatabaseItem> {
    const [type, id] = this.getArgs(interaction);
    if (type === undefined) throw new PolyHelperError('Invalid Refresh Data type');
    if (id === undefined) throw new PolyHelperError(`Could not find this ${type}?`);
    let data: BaseParsedDatabaseItem<DatabaseItem> | undefined;
    if (type === 'closeRequest') data = this.discord.application.database.getCloseRequest(id);
    if (type === 'panel') data = this.discord.application.database.getPanel(id);
    if (type === 'supportTeam') data = this.discord.application.database.getSupportTeam(id);
    if (type === 'ticket') data = this.discord.application.database.getTicket(id);
    if (!data) throw new PolyHelperError(`Could not find this ${type} data`);
    return data;
  }
}

export default DiscordButton;
