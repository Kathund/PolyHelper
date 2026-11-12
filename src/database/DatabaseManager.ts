import BasicDatabaseManager from './BasicDatabaseManager.ts';
import CloseRequest from './private/CloseRequest.ts';
import DebugTicketsCommand from '../discord/commands/guild/tickets/ticketsDebug.ts';
import Fuse from 'fuse.js';
import Panel from './private/Panel.ts';
import PolyHelperError from '../private/error.ts';
import Project from './private/Project.ts';
import SupportTeam from './private/SupportTeam.ts';
import Ticket from './private/Ticket.ts';
import TicketBlacklistUser from './private/TicketBlacklistUser.ts';
import type Application from '../Application.ts';
import type {
  BaseDatabaseItem,
  CloseRequestSearchFilters,
  DatabaseCloseRequest,
  DatabasePanel,
  DatabaseProject,
  DatabaseSupportTeam,
  DatabaseTicket,
  DatabaseTicketBlacklistUser,
  PanelSearchFilters,
  ProjectSearchFilters,
  RequiredDatabaseTicketBlacklistUserFields,
  RequiredDatabaseTicketFields,
  SupportTeamSearchFilters,
  TicketSearchFilters
} from '../types/database.ts';
import type { Message } from 'discord.js';

class DatabaseManager extends BasicDatabaseManager {
  protected override databaseMigrationsPath: string = 'src/database/migrations';
  constructor(readonly application: Application) {
    super(application.config.other.sqlitedb);
  }

  async getPanelsMessage(): Promise<Message> {
    if (!this.application.discord.isClientOnline()) {
      throw new PolyHelperError("The discord bot doesn't seam to be online? Please restart the application");
    }
    const channel = await this.application.discord.getChannel('support');
    const messageId = this.getMetadataEntry('panels-message');
    if (!messageId) {
      const message = await channel.send({ content: 'Setting up panels message' });
      this.setMetadataEntry({ key: 'panels-message', value: message.id });
      return await this.getPanelsMessage();
    }
    const message = await channel.messages.fetch(messageId.value).catch(() => null);
    if (!message) {
      this.deleteMetadataEntry('panels-message');
      return await this.getPanelsMessage();
    }
    return message;
  }

  getPanelIds(): BaseDatabaseItem['id'][] {
    return this.db
      .prepare<[], Pick<DatabasePanel, 'id'>>('SELECT id FROM panels')
      .all()
      .map((row) => row.id);
  }

  getPanels(filters: PanelSearchFilters = {}): Panel[] {
    const order = this.getOrder(filters, { LastUpdated: 'lastUpdated' });
    return this.db
      .prepare<
        {
          enabled: DatabasePanel['enabled'] | null;
          supportTeamId: DatabasePanel['supportTeamId'];
          filterSupportTeamId: number;
          limit: number;
        },
        DatabasePanel
      >(
        `SELECT * FROM panels WHERE (@enabled IS NULL OR enabled = @enabled) AND (@filterSupportTeamId = 0 OR supportTeamId IS @supportTeamId)${order} LIMIT @limit`
      )
      .all({
        enabled: filters.enabled === undefined ? null : filters.enabled ? 1 : 0,
        supportTeamId: filters.supportTeamId ?? null,
        filterSupportTeamId: filters.supportTeamId === undefined ? 0 : 1,
        limit: filters.limit ?? -1
      })
      .map((data) => new Panel(data, this));
  }

  getPanel(id: BaseDatabaseItem['id']): Panel | undefined {
    const data = this.db.prepare<[BaseDatabaseItem['id']], DatabasePanel>('SELECT * FROM panels WHERE id = ?').get(id);
    if (!data) return data;
    return new Panel(data, this);
  }

  async insertPanel(data: Omit<DatabasePanel, keyof BaseDatabaseItem>): Promise<Panel> {
    const missingData: BaseDatabaseItem = { id: crypto.randomUUID(), lastUpdated: Date.now() };
    this.db
      .prepare<DatabasePanel>(
        'INSERT INTO panels (id, lastUpdated, name, title, description, buttonLabel, buttonEmoji, buttonStyle, openingMessage, openingMessageTitle, openingMessageContent, maxOpenTickets, pinnedTicketPrefix, closedTicketPrefix, defaultTicketName, pingSupportTeamOnOpen, supportTeamId, enabled) VALUES (@id, @lastUpdated, @name, @title, @description, @buttonLabel, @buttonEmoji, @buttonStyle, @openingMessage, @openingMessageTitle, @openingMessageContent, @maxOpenTickets, @pinnedTicketPrefix, @closedTicketPrefix, @defaultTicketName, @pingSupportTeamOnOpen, @supportTeamId, @enabled)'
      )
      .run({ ...data, ...missingData });
    const panel = this.getPanel(missingData.id);
    if (!panel) throw new PolyHelperError('Something went wrong while inserting a panel');
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
    return panel;
  }

  async deletePanel(id: BaseDatabaseItem['id']) {
    this.db.prepare<BaseDatabaseItem['id']>('DELETE FROM panels WHERE id = ?').run(id);
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
  }

  async updatePanel(data: Omit<DatabasePanel, 'lastUpdated'>): Promise<Panel> {
    const panel = this.getPanel(data.id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    this.db
      .prepare<DatabasePanel>(
        'UPDATE panels SET lastUpdated = @lastUpdated, name = @name, title = @title, description = @description, buttonLabel = @buttonLabel, buttonEmoji = @buttonEmoji, buttonStyle = @buttonStyle, openingMessage = @openingMessage, openingMessageTitle = @openingMessageTitle, openingMessageContent = @openingMessageContent, maxOpenTickets = @maxOpenTickets, pinnedTicketPrefix = @pinnedTicketPrefix, closedTicketPrefix = @closedTicketPrefix, defaultTicketName = @defaultTicketName, pingSupportTeamOnOpen = @pingSupportTeamOnOpen, supportTeamId = @supportTeamId, enabled = @enabled WHERE id = @id'
      )
      .run({ ...data, lastUpdated });
    const newPanel = this.getPanel(data.id);
    if (!newPanel) throw new PolyHelperError('Something went wrong while updating a panel');
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
    return newPanel;
  }

  getTicket(id: BaseDatabaseItem['id']): Ticket | undefined {
    const data = this.db
      .prepare<[BaseDatabaseItem['id']], DatabaseTicket>('SELECT * FROM tickets WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new Ticket(data, this);
  }

  getTickets(filters: TicketSearchFilters = {}): Ticket[] {
    const order = this.getOrder(filters, {
      LastUpdated: 'lastUpdated',
      OpeningTimestamp: 'openingTimestamp',
      LastMessageTimestamp: 'lastMessageTimestamp'
    });

    return this.db
      .prepare<
        {
          panelId: DatabaseTicket['panelId'] | null;
          owner: DatabaseTicket['owner'] | null;
          pinned: DatabaseTicket['closed'] | null;
          inactivitySilenced: DatabaseTicket['inactivitySilenced'] | null;
          autoClose: DatabaseTicket['closed'] | null;
          closed: DatabaseTicket['closed'] | null;
          taggedProjectId: DatabaseTicket['taggedProjectId'] | null;
          closedBy: DatabaseTicket['closedBy'] | null;
          limit: number;
        },
        DatabaseTicket
      >(
        `SELECT * FROM tickets WHERE (@panelId IS NULL OR panelId = @panelId) AND (@owner IS NULL OR owner = @owner) AND (@pinned IS NULL OR (pinMessageId IS NOT NULL) = @pinned) AND (@inactivitySilenced IS NULL OR inactivitySilenced = @inactivitySilenced) AND (@autoClose IS NULL OR EXISTS (SELECT 1 FROM closeRequests WHERE closeRequests.ticketId = tickets.id AND closeRequests.autoClose IS NOT NULL) = @autoClose) AND (@closed IS NULL OR closed = @closed) AND (@taggedProjectId IS NULL OR taggedProjectId = @taggedProjectId) AND (@closedBy IS NULL OR closedBy = @closedBy)${order} LIMIT @limit`
      )
      .all({
        panelId: filters.panelId ?? null,
        owner: filters.owner ?? null,
        pinned: filters.pinned === undefined ? null : filters.pinned ? 1 : 0,
        inactivitySilenced: filters.inactivitySilenced === undefined ? null : filters.inactivitySilenced ? 1 : 0,
        autoClose: filters.autoClose === undefined ? null : filters.autoClose ? 1 : 0,
        closed: filters.closed === undefined ? null : filters.closed ? 1 : 0,
        taggedProjectId: filters.taggedProjectId ?? null,
        closedBy: filters.closedBy ?? null,
        limit: filters.limit ?? -1
      })
      .map((data) => new Ticket(data, this));
  }

  getTicketByThreadId(id: DatabaseTicket['threadId']): Ticket | undefined {
    const data = this.db
      .prepare<[DatabaseTicket['threadId']], DatabaseTicket>('SELECT * FROM tickets WHERE threadId = ?')
      .get(id);
    if (data === undefined) return data;
    return new Ticket(data, this);
  }

  insertTicket(data: Pick<DatabaseTicket, RequiredDatabaseTicketFields>): Ticket {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    this.db
      .prepare<Pick<DatabaseTicket, keyof BaseDatabaseItem | RequiredDatabaseTicketFields | 'openingTimestamp'>>(
        'INSERT INTO tickets (id, lastUpdated, name, panelId, threadId, owner, startingMessageId, openingTimestamp) VALUES (@id, @lastUpdated, @name, @panelId, @threadId, @owner, @startingMessageId, @openingTimestamp)'
      )
      .run({ ...data, id, lastUpdated: timestamp, openingTimestamp: timestamp });
    const ticket = this.getTicket(id);
    if (!ticket) throw new PolyHelperError('Something went wrong with inserting this ticket');
    return ticket;
  }

  updateTicket(data: Omit<DatabaseTicket, 'lastUpdated'>): Ticket {
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    const update = this.db
      .prepare<DatabaseTicket>(
        'UPDATE tickets SET lastUpdated = @lastUpdated, panelId = @panelId, threadId = @threadId, owner = @owner, pinMessageId = @pinMessageId, startingMessageId = @startingMessageId, openingTimestamp = @openingTimestamp, lastMessageTimestamp = @lastMessageTimestamp, inactivityNoticeId = @inactivityNoticeId, inactivitySilenced = @inactivitySilenced, name = @name, taggedProjectId = @taggedProjectId, closedBy = @closedBy, closedReason = @closedReason, closed = @closed WHERE id = @id'
      )
      .run({ ...data, lastUpdated });
    if (update.changes === 0) throw new PolyHelperError('Could not find this ticket?');
    return new Ticket({ ...data, lastUpdated }, this);
  }

  getCloseRequest(id: BaseDatabaseItem['id']): CloseRequest | undefined {
    const data = this.db
      .prepare<[BaseDatabaseItem['id']], DatabaseCloseRequest>('SELECT * FROM closeRequests WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new CloseRequest(data, this);
  }

  getCloseRequests(filters: CloseRequestSearchFilters = {}): CloseRequest[] {
    const order = this.getOrder(filters, { LastUpdated: 'lastUpdated', AutoClose: 'autoClose' });
    return this.db
      .prepare<
        {
          closer: DatabaseCloseRequest['closer'] | null;
          hasAutoClose: DatabaseCloseRequest['autoClose'] | null;
          limit: number;
        },
        DatabaseCloseRequest
      >(
        `SELECT * FROM closeRequests WHERE (@closer IS NULL OR closer = @closer) AND (@hasAutoClose IS NULL OR (autoClose IS NOT NULL) = @hasAutoClose)${order} LIMIT @limit`
      )
      .all({
        closer: filters.closer ?? null,
        hasAutoClose: filters.hasAutoClose === undefined ? null : filters.hasAutoClose ? 1 : 0,
        limit: filters.limit ?? -1
      })
      .map((data) => new CloseRequest(data, this));
  }

  getCloseRequestByTicketId(id: DatabaseCloseRequest['ticketId']): CloseRequest | undefined {
    const data = this.db
      .prepare<[DatabaseCloseRequest['ticketId']], DatabaseCloseRequest>(
        'SELECT * FROM closeRequests WHERE ticketId = ?'
      )
      .get(id);
    if (data === undefined) return data;
    return new CloseRequest(data, this);
  }

  getCloseRequestByAutoClose(timestamp: number = Date.now()): CloseRequest[] {
    return this.db
      .prepare<[number], DatabaseCloseRequest>(
        'SELECT * FROM closeRequests WHERE autoClose IS NOT NULL AND autoClose <= ?'
      )
      .all(timestamp)
      .map((closeRequest) => new CloseRequest(closeRequest, this));
  }

  insertCloseRequest(data: Omit<DatabaseCloseRequest, 'lastUpdated'>): CloseRequest {
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    this.db
      .prepare<DatabaseCloseRequest>(
        'INSERT INTO closeRequests (id, lastUpdated, ticketId, messageId, reason, closer, autoClose) VALUES (@id, @lastUpdated, @ticketId, @messageId, @reason, @closer, @autoClose)'
      )
      .run({ ...data, lastUpdated });
    return new CloseRequest({ ...data, lastUpdated }, this);
  }

  async deleteCloseRequest(id: BaseDatabaseItem['id']) {
    const closeRequest = this.getCloseRequest(id);
    if (closeRequest) await closeRequest.updateMessageButtons(true);
    this.db.prepare<BaseDatabaseItem['id']>('DELETE FROM closeRequests WHERE id = ?').run(id);
  }

  getSupportTeam(id: BaseDatabaseItem['id']): SupportTeam | undefined {
    const data = this.db
      .prepare<[BaseDatabaseItem['id']], DatabaseSupportTeam>('SELECT * FROM supportTeams WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new SupportTeam(data, this);
  }

  getSupportTeams(filters: SupportTeamSearchFilters = {}): SupportTeam[] {
    const order = this.getOrder(filters, { LastUpdated: 'lastUpdated' });
    return this.db
      .prepare<
        {
          supportRole: DatabaseSupportTeam['supportRole'] | null;
          ticketPingRole: DatabaseSupportTeam['ticketPingRole'] | null;
          limit: number;
        },
        DatabaseSupportTeam
      >(
        `SELECT * FROM supportTeams WHERE (@supportRole IS NULL OR supportRole = @supportRole) AND (@ticketPingRole IS NULL OR ticketPingRole = @ticketPingRole)${order} LIMIT @limit`
      )
      .all({
        supportRole: filters.supportRole ?? null,
        ticketPingRole: filters.ticketPingRole ?? null,
        limit: filters.limit ?? -1
      })
      .map((data) => new SupportTeam(data, this));
  }

  insertSupportTeam(data: Omit<DatabaseSupportTeam, keyof BaseDatabaseItem>): SupportTeam {
    const missingData: BaseDatabaseItem = { id: crypto.randomUUID(), lastUpdated: Date.now() };
    this.db
      .prepare<DatabaseSupportTeam>(
        'INSERT INTO supportTeams (id, lastUpdated, name, supportRole, ticketPingRole) VALUES (@id, @lastUpdated, @name, @supportRole, @ticketPingRole)'
      )
      .run({ ...data, ...missingData });
    return new SupportTeam({ ...data, ...missingData }, this);
  }

  updateSupportTeam(data: Omit<DatabaseSupportTeam, 'lastUpdated'>): SupportTeam {
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    const update = this.db
      .prepare<DatabaseSupportTeam>(
        'UPDATE supportTeams SET lastUpdated = @lastUpdated, name = @name, supportRole = @supportRole, ticketPingRole = @ticketPingRole WHERE id = @id'
      )
      .run({ ...data, lastUpdated });
    if (update.changes === 0) throw new PolyHelperError('Could not find this support team?');
    return new SupportTeam({ ...data, lastUpdated }, this);
  }

  async deleteSupportTeam(id: BaseDatabaseItem['id']) {
    const supportTeam = this.getSupportTeam(id);
    if (supportTeam) {
      for (const panel of supportTeam.panels) await this.updatePanel({ ...panel.toJSON(), supportTeamId: null });
    }
    this.db.prepare<BaseDatabaseItem['id']>('DELETE FROM supportTeams WHERE id = ?').run(id);
  }

  getTicketBlacklistUser(id: BaseDatabaseItem['id']): TicketBlacklistUser | undefined {
    const data = this.db
      .prepare<[BaseDatabaseItem['id']], DatabaseTicketBlacklistUser>('SELECT * FROM ticketBlacklistUsers WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new TicketBlacklistUser(data, this);
  }

  getTicketBlacklistUserByUser(user: TicketBlacklistUser['user']): TicketBlacklistUser | undefined {
    const data = this.db
      .prepare<[TicketBlacklistUser['user']], DatabaseTicketBlacklistUser>(
        'SELECT * FROM ticketBlacklistUsers WHERE user = ? ORDER BY active DESC, lastUpdated DESC'
      )
      .get(user);
    if (!data) return data;
    return new TicketBlacklistUser(data, this);
  }

  async insertTicketBlacklistUser(
    data: Pick<DatabaseTicketBlacklistUser, RequiredDatabaseTicketBlacklistUserFields>
  ): Promise<TicketBlacklistUser> {
    const id = crypto.randomUUID();
    this.db
      .prepare<Pick<DatabaseTicketBlacklistUser, keyof BaseDatabaseItem | RequiredDatabaseTicketBlacklistUserFields>>(
        'INSERT INTO ticketBlacklistUsers (id, lastUpdated, user, reason, addedBy) VALUES (@id, @lastUpdated, @user, @reason, @addedBy)'
      )
      .run({ ...data, id, lastUpdated: Date.now() });
    const parsed = this.getTicketBlacklistUser(id);
    if (!parsed) throw new PolyHelperError('Something went wrong with inserting this ticket blacklist user');
    const message = await (await this.application.discord.getChannel('botLogs')).send(parsed.toMessageData());
    return this.updateTicketBlacklistUser({ ...parsed.toJSON(), logMessageId: message.id });
  }

  updateTicketBlacklistUser(data: Omit<DatabaseTicketBlacklistUser, 'lastUpdated'>): TicketBlacklistUser {
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    const update = this.db
      .prepare<DatabaseTicketBlacklistUser>(
        'UPDATE ticketBlacklistUsers SET lastUpdated = @lastUpdated, user = @user, reason = @reason, addedBy = @addedBy, active = @active, removedReason = @removedReason, removedBy = @removedBy, logMessageId = @logMessageId WHERE id = @id'
      )
      .run({ ...data, lastUpdated });
    if (update.changes === 0) throw new PolyHelperError('Could not find this ticket blacklist user?');
    return new TicketBlacklistUser({ ...data, lastUpdated }, this);
  }

  async removeTicketBlacklistUser(data: Pick<DatabaseTicketBlacklistUser, 'id' | 'removedReason' | 'removedBy'>) {
    const ticketBlacklistUser = this.getTicketBlacklistUser(data.id);
    if (!ticketBlacklistUser) throw new PolyHelperError('Could not find this ticket blacklist user?');
    const updated = this.updateTicketBlacklistUser({ ...ticketBlacklistUser.toJSON(), ...data, active: 0 });
    const logMessage = await updated.getLogMessage();
    let message: Message;
    if (logMessage) {
      await logMessage.edit(updated.toMessageData());
      message = await logMessage.reply({ ...updated.toMessageData(), content: 'Blacklist Removed' });
    } else {
      message = await (await this.application.discord.getChannel('botLogs')).send(updated.toMessageData());
    }
    return this.updateTicketBlacklistUser({ ...updated.toJSON(), logMessageId: message.id });
  }

  getProject(id: BaseDatabaseItem['id']): Project | undefined {
    const data = this.db
      .prepare<[BaseDatabaseItem['id']], DatabaseProject>('SELECT * FROM projects WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new Project(data, this);
  }

  getProjectByName(name: DatabaseProject['name']): Project | undefined {
    const data = this.db
      .prepare<[DatabaseProject['name']], DatabaseProject>('SELECT * FROM projects WHERE name = ?')
      .get(name);
    if (!data) return data;
    return new Project(data, this);
  }

  getProjectByModrinthId(modrinthId: Exclude<DatabaseProject['modrinthId'], null>): Project | undefined {
    const data = this.db
      .prepare<[Exclude<DatabaseProject['modrinthId'], null>], DatabaseProject>(
        'SELECT * FROM projects WHERE modrinthId = ?'
      )
      .get(modrinthId);
    if (!data) return data;
    return new Project(data, this);
  }

  getProjects(filters: ProjectSearchFilters = {}): Project[] {
    const order = this.getOrder(filters, { LastUpdated: 'lastUpdated' });
    return this.db
      .prepare<{ source: DatabaseProject['source'] | null; limit: number }, DatabaseProject>(
        `SELECT * FROM projects WHERE (@source IS NULL OR source = @source)${order} LIMIT @limit`
      )
      .all({ source: filters.source ?? null, limit: filters.limit ?? -1 })
      .map((data) => new Project(data, this));
  }

  searchProjectNames(input: string): Project[] {
    const projects = this.db.prepare<[], DatabaseProject>('SELECT * FROM projects').all();
    const exactMatch = projects.find((project) => project.name.toLowerCase() === input.toLowerCase());
    if (exactMatch) return [new Project(exactMatch, this)];
    return new Fuse(projects, { keys: ['name'], isCaseSensitive: false })
      .search(input)
      .map(({ item }) => new Project(item, this));
  }

  insertProject(data: Omit<DatabaseProject, keyof BaseDatabaseItem>): Project {
    const id: BaseDatabaseItem['id'] = crypto.randomUUID();
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    this.db
      .prepare<DatabaseProject>(
        'INSERT INTO projects (id, lastUpdated, name, source, sourceUrl, modrinthId, notes) VALUES (@id, @lastUpdated, @name, @source, @sourceUrl, @modrinthId, @notes)'
      )
      .run({ ...data, id, lastUpdated });
    return new Project({ ...data, id, lastUpdated }, this);
  }

  updateProject(data: Omit<DatabaseProject, 'lastUpdated'>): Project {
    const lastUpdated: BaseDatabaseItem['lastUpdated'] = Date.now();
    const update = this.db
      .prepare<DatabaseProject>(
        'UPDATE projects SET lastUpdated = @lastUpdated, name = @name, source = @source, sourceUrl = @sourceUrl, modrinthId = @modrinthId, notes = @notes WHERE id = @id'
      )
      .run({ ...data, lastUpdated });
    if (update.changes === 0) throw new PolyHelperError('Could not find this project?');
    return new Project({ ...data, lastUpdated }, this);
  }

  deleteProject(id: BaseDatabaseItem['id']) {
    this.db.prepare<BaseDatabaseItem['id']>('DELETE FROM projects WHERE id = ?').run(id);
  }
}

export default DatabaseManager;
