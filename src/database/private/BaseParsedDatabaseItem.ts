import type EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type { AutocompleteOption } from '../../types/discord.ts';

abstract class BaseParsedDatabaseItem<DatabaseType> {
  abstract toAutocompleteOption(): AutocompleteOption;
  abstract toEmbed(): EmbedHelper;
  abstract toJSON(): DatabaseType;
}

export default BaseParsedDatabaseItem;
