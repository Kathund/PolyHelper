import BaseParsedDatabaseItem from './BaseParsedDatabaseItem.ts';
import PolyHelperError from '../../private/error.ts';
import type DatabaseManager from '../DatabaseManager.ts';
import type Panel from './Panel.ts';
import type { AutocompleteOption } from '../../types/discord.ts';
import type { DatabaseSupportTeam } from '../../types/database.ts';
import type { Role } from 'discord.js';

class SupportTeam extends BaseParsedDatabaseItem<DatabaseSupportTeam> {
  readonly id: DatabaseSupportTeam['id'];
  readonly name: DatabaseSupportTeam['name'];
  readonly supportRole: DatabaseSupportTeam['supportRole'];
  readonly ticketPingRole: DatabaseSupportTeam['ticketPingRole'];
  constructor(
    data: DatabaseSupportTeam,
    private readonly manager: DatabaseManager
  ) {
    super();
    this.id = data.id;
    this.name = data.name;
    this.supportRole = data.supportRole;
    this.ticketPingRole = data.ticketPingRole;
  }

  async getSupportRole(): Promise<Role> {
    if (!this.manager.application.discord.isGuildReady()) {
      await this.manager.application.discord.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }

    const role = await this.manager.application.discord.guild.roles.fetch(this.supportRole);
    if (!role) throw new PolyHelperError('Could not fine the support role');
    return role;
  }

  async getTicketPingRole(): Promise<Role> {
    if (!this.manager.application.discord.isGuildReady()) {
      await this.manager.application.discord.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }

    const role = await this.manager.application.discord.guild.roles.fetch(this.ticketPingRole);
    if (!role) throw new PolyHelperError('Could not fine the support role');
    return role;
  }

  getPanels(): Panel[] {
    return this.manager.getPanels({ supportTeamId: this.id });
  }

  override toAutocompleteOption(): AutocompleteOption {
    return { name: this.name, value: this.id };
  }

  override toJSON(): DatabaseSupportTeam {
    return { id: this.id, name: this.name, supportRole: this.supportRole, ticketPingRole: this.ticketPingRole };
  }
}

export default SupportTeam;
