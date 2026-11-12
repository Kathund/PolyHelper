import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import { ActionRowBuilder, type BaseMessageOptions, ButtonBuilder, ButtonStyle } from 'discord.js';
import type DatabaseManager from '../DatabaseManager.ts';
import type EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseProject } from '../../types/database.ts';

class Project extends BaseParsedDatabaseItem<DatabaseProject> {
  readonly name: DatabaseProject['name'];
  readonly source: DatabaseProject['source'];
  readonly sourceUrl: DatabaseProject['sourceUrl'];
  readonly modrinthId: DatabaseProject['modrinthId'];
  readonly notes: DatabaseProject['notes'];
  constructor(data: DatabaseProject, manager: DatabaseManager) {
    super(data, manager);
    this.name = data.name;
    this.source = data.source;
    this.sourceUrl = data.sourceUrl;
    this.modrinthId = data.modrinthId;
    this.notes = data.notes;
  }

  getGithubMetadata(): { owner: string; repository: string } | null {
    if (this.sourceUrl === null) return null;
    const match = this.sourceUrl.match(
      /^https?:\/\/github\.com\/(?<owner>[^\/\s]+)\/(?<repository>[^\/\s]+)(?:\/.*)?$/
    );
    if (!match?.groups) return null;
    if (!match.groups.owner || !match.groups.repository) return null;
    return { owner: match.groups.owner, repository: match.groups.repository };
  }

  override toEmbed(): EmbedHelper {
    return super
      .toEmbed()
      .setTitle('Showing Project Data')
      .addFields(
        { name: 'Name', value: this.name, format: 'Block' },
        { name: 'Source', value: this.source, format: 'Block' },
        { name: 'Github', value: this.sourceUrl ?? '-' },
        { name: 'Modrinth', value: this.modrinthId ?? '-' },
        { name: 'Notes', value: this.notes ?? '-', format: 'Block' }
      );
  }

  override toMessageData(): BaseMessageOptions {
    return {
      embeds: [this.toEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Edit').setStyle(ButtonStyle.Secondary).setCustomId(`editProject:${this.id}`)
        ),
        this.getRefreshExportRow('project')
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: this.name, value: this.id };
  }

  override toJSON(): DatabaseProject {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      name: this.name,
      source: this.source,
      sourceUrl: this.sourceUrl,
      modrinthId: this.modrinthId,
      notes: this.notes
    };
  }
}

export default Project;
