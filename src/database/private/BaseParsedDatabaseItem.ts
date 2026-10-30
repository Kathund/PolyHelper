import type EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { BaseMessageOptions } from 'discord.js';

abstract class BaseParsedDatabaseItem<DatabaseType> {
  abstract toAutocompleteOption(): AutocompleteOption;
  abstract toEmbed(): EmbedHelper;
  abstract toMessageData(): BaseMessageOptions | Promise<BaseMessageOptions>;
  abstract toJSON(): DatabaseType;
}

export default BaseParsedDatabaseItem;
