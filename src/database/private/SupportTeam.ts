import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  type Role,
  StringSelectMenuBuilder
} from 'discord.js';
import { PanelStringSelectMenu } from '../../discord/private/ComponentHelper.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type EmbedHelper from '../../discord/private/EmbedHelper.ts';
import type Panel from './Panel.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseSupportTeam } from '../../types/database.ts';

class SupportTeam extends BaseParsedDatabaseItem<DatabaseSupportTeam> {
  readonly name: DatabaseSupportTeam['name'];
  readonly supportRole: DatabaseSupportTeam['supportRole'];
  readonly newTicketPingRole: DatabaseSupportTeam['newTicketPingRole'];
  readonly inactivityTicketPingRole: DatabaseSupportTeam['inactivityTicketPingRole'];
  constructor(data: DatabaseSupportTeam, manager: DatabaseManager) {
    super(data, manager);
    this.name = data.name;
    this.supportRole = data.supportRole;
    this.newTicketPingRole = data.newTicketPingRole;
    this.inactivityTicketPingRole = data.inactivityTicketPingRole;
  }

  get panels(): Panel[] {
    return this.manager.getPanels({ supportTeamId: this.id });
  }

  async getSupportRole(): Promise<Role> {
    return await this.getRole(this.supportRole);
  }

  async getNewTicketPingRole(): Promise<Role> {
    return await this.getRole(this.newTicketPingRole);
  }

  async getInactivityTicketPingRole(): Promise<Role> {
    return await this.getRole(this.inactivityTicketPingRole);
  }

  override toEmbed(): EmbedHelper {
    return super
      .toEmbed()
      .setTitle('Showing Support Team Data')
      .addFields(
        { name: 'Name', value: this.name, format: 'Block' },
        { name: 'Support Role', value: `<@&${this.supportRole}> (\`${this.supportRole}\`)` },
        { name: 'New Ticket Ping Role', value: `<@&${this.newTicketPingRole}> (\`${this.newTicketPingRole}\`)` },
        {
          name: 'Ticket Inactivity Ping Role',
          value: `<@&${this.inactivityTicketPingRole}> (\`${this.inactivityTicketPingRole}\`)`
        },
        { name: 'Amount of Panels', value: this.panels.length, format: 'Number Small Block' }
      );
  }

  override toMessageData(): BaseMessageOptions {
    return {
      embeds: [this.toEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Edit').setStyle(ButtonStyle.Secondary).setCustomId(`editSupportTeam:${this.id}`)
        ),
        this.getRefreshExportRow('supportTeam'),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          PanelStringSelectMenu(this.panels)
            .setCustomId('selectPanel')
            .setPlaceholder('View a Panel')
            .setMinValues(1)
            .setMaxValues(1)
        )
      ]
    };
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: `${this.name} (${this.id})`, value: this.id };
  }

  override toJSON(): DatabaseSupportTeam {
    return {
      id: this.id,
      lastUpdated: this.lastUpdated,
      name: this.name,
      supportRole: this.supportRole,
      newTicketPingRole: this.newTicketPingRole,
      inactivityTicketPingRole: this.inactivityTicketPingRole
    };
  }
}

export default SupportTeam;
