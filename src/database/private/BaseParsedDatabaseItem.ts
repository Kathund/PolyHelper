import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { BaseDatabaseItem } from '../../types/database.ts';
import type { BaseMessageOptions } from 'discord.js';

abstract class BaseParsedDatabaseItem<DatabaseType> {
  readonly id: BaseDatabaseItem['id'];
  readonly lastUpdated: BaseDatabaseItem['lastUpdated'];
  constructor(data: BaseDatabaseItem) {
    this.id = data.id;
    this.lastUpdated = data.lastUpdated;
  }

  toEmbed(): EmbedHelper {
    return new EmbedHelper()
      .setStyle('DataInfo')
      .addFields(
        { name: 'ID', value: this.id, format: 'Block' },
        { name: 'Last Updated', value: Math.floor(this.lastUpdated / 1000), format: 'Timestamp' }
      );
  }

  abstract toAutocompleteOption(): AutocompleteOption;
  abstract toMessageData(): BaseMessageOptions | Promise<BaseMessageOptions>;
  abstract toJSON(): DatabaseType;
}

export default BaseParsedDatabaseItem;
