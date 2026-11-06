import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import { ActionRowBuilder, type BaseMessageOptions, ButtonBuilder, ButtonStyle, type GuildMember } from 'discord.js';
import type DatabaseManager from '../DatabaseManager.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { BaseDatabaseItem } from '../../types/database.ts';

abstract class BaseParsedDatabaseItem<DatabaseType> {
  readonly id: BaseDatabaseItem['id'];
  readonly lastUpdated: BaseDatabaseItem['lastUpdated'];
  constructor(
    data: BaseDatabaseItem,
    protected readonly manager: DatabaseManager
  ) {
    this.id = data.id;
    this.lastUpdated = data.lastUpdated;
  }

  protected async getGuildMember(userId: string): Promise<GuildMember> {
    if (!this.manager.application.discord.isGuildReady()) {
      await this.manager.application.discord.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }

    return await this.manager.application.discord.guild.members.fetch(userId);
  }

  toEmbed(): EmbedHelper {
    return new EmbedHelper()
      .setStyle('DataInfo')
      .addFields(
        { name: 'ID', value: this.id, format: 'Block' },
        { name: 'Last Updated', value: Math.floor(this.lastUpdated / 1000), format: 'Timestamp' }
      );
  }

  protected getRefreshExportRow(type: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`refreshData:${type}:${this.id}`),
      new ButtonBuilder()
        .setLabel('Export JSON')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`exportData:${type}:${this.id}`)
    );
  }

  toAutocompleteOption(): AutocompleteOption | Promise<AutocompleteOption> {
    return { name: this.id, value: this.id };
  }

  abstract toMessageData(): BaseMessageOptions | Promise<BaseMessageOptions>;
  abstract toJSON(): DatabaseType;
}

export default BaseParsedDatabaseItem;
