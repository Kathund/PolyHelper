import BasicDatabaseManager from './BasicDatabaseManager.ts';
import CloseRequest from './private/CloseRequest.ts';
import DebugTicketsCommand from '../discord/commands/guild/tickets/ticketsDebug.ts';
import Panel from './private/Panel.ts';
import PolyHelperError from '../private/error.ts';
import SupportTeam from './private/SupportTeam.ts';
import Ticket from './private/Ticket.ts';
import type Application from '../Application.ts';
import type {
  DatabaseCloseRequest,
  DatabasePanel,
  DatabaseSupportTeam,
  DatabaseTicket,
  DatabaseTicketActivity,
  PanelSearchFilters,
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

  getPanelIds(): DatabasePanel['id'][] {
    return this.db
      .prepare<[], Pick<DatabasePanel, 'id'>>('SELECT id FROM panels')
      .all()
      .map((row) => row.id);
  }

  getPanels(filters: PanelSearchFilters = {}): Panel[] {
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
        'SELECT * FROM panels WHERE (@enabled IS NULL OR enabled = @enabled) AND (@filterSupportTeamId = 0 OR supportTeamId IS @supportTeamId) LIMIT @limit'
      )
      .all({
        enabled: filters.enabled === undefined ? null : filters.enabled ? 1 : 0,
        supportTeamId: filters.supportTeamId ?? null,
        filterSupportTeamId: filters.supportTeamId === undefined ? 0 : 1,
        limit: filters.limit ?? -1
      })
      .map((data) => new Panel(data, this));
  }

  getPanel(id: DatabasePanel['id']): Panel | undefined {
    const data = this.db.prepare<[DatabasePanel['id']], DatabasePanel>('SELECT * FROM panels WHERE id = ?').get(id);
    if (!data) return data;
    return new Panel(data, this);
  }

  async insertPanel(panelData: Omit<DatabasePanel, 'id'>): Promise<Panel> {
    const id: DatabasePanel['id'] = crypto.randomUUID();
    this.db
      .prepare<DatabasePanel>(
        'INSERT INTO panels (id, name, cleanName, title, description, buttonLabel, buttonEmoji, openingMessage, maxOpenTickets, pinnedTicketPrefix, closedTicketPrefix, defaultTicketName, pingSupportRoleOnOpen, supportTeamId, enabled) VALUES (@id, @name, @cleanName, @title, @description, @buttonLabel, @buttonEmoji, @openingMessage, @maxOpenTickets, @pinnedTicketPrefix, @closedTicketPrefix, @defaultTicketName, @pingSupportRoleOnOpen, pingSupportRoleOnOpen, @supportTeamId, @enabled)'
      )
      .run({ ...panelData, id });
    const panel = this.getPanel(id);
    if (!panel) throw new PolyHelperError('Something went wrong while inserting a panel');
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
    return panel;
  }

  async deletePanel(id: DatabasePanel['id']) {
    this.db.prepare<DatabasePanel['id']>('DELETE FROM panels WHERE id = ?').run(id);
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
  }

  async updatePanel(data: DatabasePanel): Promise<Panel> {
    const panel = this.getPanel(data.id);
    if (!panel) throw new PolyHelperError('Could not find this panel?');
    this.db
      .prepare<DatabasePanel>(
        'UPDATE panels SET name = @name, cleanName = @cleanName, title = @title, description = @description, buttonLabel = @buttonLabel, buttonEmoji = @buttonEmoji, openingMessage = @openingMessage, maxOpenTickets = @maxOpenTickets, pinnedTicketPrefix = @pinnedTicketPrefix, closedTicketPrefix = @closedTicketPrefix, defaultTicketName = @defaultTicketName, pingSupportRoleOnOpen = @pingSupportRoleOnOpen, supportTeamId = @supportTeamId, enabled = @enabled WHERE id = @id'
      )
      .run(data);
    const newPanel = this.getPanel(data.id);
    if (!newPanel) throw new PolyHelperError('Something went wrong while updating a panel');
    const message = await this.getPanelsMessage();
    await DebugTicketsCommand.updatePanelsMessage(message);
    return newPanel;
  }

  getTicket(id: DatabaseTicket['id']): Ticket | undefined {
    const data = this.db.prepare<[DatabaseTicket['id']], DatabaseTicket>('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!data) return data;
    return new Ticket(data, this);
  }

  getTickets(filters: TicketSearchFilters = {}): Ticket[] {
    return this.db
      .prepare<
        {
          panelId: DatabaseTicket['panelId'] | null;
          owner: DatabaseTicket['owner'] | null;
          pinned: DatabaseTicket['closed'] | null;
          autoClose: DatabaseTicket['closed'] | null;
          closed: DatabaseTicket['closed'] | null;
          limit: number;
        },
        DatabaseTicket
      >(
        'SELECT * FROM tickets WHERE (@panelId IS NULL OR panelId = @panelId) AND (@owner IS NULL OR owner = @owner) AND (@pinned IS NULL OR (pinMessageId IS NOT NULL) = @pinned) AND (@autoClose IS NULL OR EXISTS (SELECT 1 FROM closeRequests WHERE closeRequests.ticketId = tickets.id AND closeRequests.autoClose IS NOT NULL) = @autoClose) AND (@closed IS NULL OR closed = @closed) LIMIT @limit'
      )
      .all({
        panelId: filters.panelId ?? null,
        owner: filters.owner ?? null,
        pinned: filters.pinned === undefined ? null : filters.pinned ? 1 : 0,
        autoClose: filters.autoClose === undefined ? null : filters.autoClose ? 1 : 0,
        closed: filters.closed ?? null,
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

  insertTicket(ticketData: Omit<DatabaseTicket, 'id'>): Ticket {
    const id: DatabaseTicket['id'] = crypto.randomUUID();
    this.db
      .prepare<DatabaseTicket>(
        'INSERT INTO tickets (id, panelId, threadId, owner, pinMessageId, startingMessageId, openingTimestamp, name, closed, lastMessageTimestamp, lastMessageBySupport, inactivityAlerts, lastAlertTimestamp) VALUES (@id, @panelId, @threadId, @owner, @pinMessageId, @startingMessageId, @openingTimestamp, @name, @closed, @lastMessageTimestamp, @lastMessageBySupport, @inactivityAlerts, @lastAlertTimestamp)'
      )
      .run({ ...ticketData, id });
    return new Ticket({ ...ticketData, id }, this);
  }

  updateTicket(data: DatabaseTicket): Ticket {
    const update = this.db
      .prepare<DatabaseTicket>(
        'UPDATE tickets SET panelId = @panelId, threadId = @threadId, owner = @owner, pinMessageId = @pinMessageId, startingMessageId = @startingMessageId, openingTimestamp = @openingTimestamp, name = @name, closed = @closed WHERE id = @id'
      )
      .run(data);
    if (update.changes === 0) throw new PolyHelperError('Could not find this ticket?');
    return new Ticket(data, this);
  }

  updateTicketActivity(id: DatabaseTicket['id'], activity: DatabaseTicketActivity): Ticket {
    this.db
      .prepare<DatabaseTicketActivity & Pick<DatabaseTicket, 'id'>>(
        'UPDATE tickets SET lastMessageTimestamp = @lastMessageTimestamp, lastMessageBySupport = @lastMessageBySupport, inactivityAlerts = @inactivityAlerts, lastAlertTimestamp = @lastAlertTimestamp WHERE id = @id'
      )
      .run({ ...activity, id });
    const ticket = this.getTicket(id);
    if (!ticket) throw new PolyHelperError('Could not find this ticket?');
    return ticket;
  }

  getCloseRequest(id: DatabaseCloseRequest['id']): CloseRequest | undefined {
    const data = this.db
      .prepare<[DatabaseCloseRequest['id']], DatabaseCloseRequest>('SELECT * FROM closeRequests WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new CloseRequest(data, this);
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

  insertCloseRequest(closeRequestData: DatabaseCloseRequest): CloseRequest {
    this.db
      .prepare<DatabaseCloseRequest>(
        'INSERT INTO closeRequests (id, ticketId, messageId, reason, closer, autoClose) VALUES (@id, @ticketId, @messageId, @reason, @closer, @autoClose)'
      )
      .run(closeRequestData);
    return new CloseRequest(closeRequestData, this);
  }

  async deleteCloseRequest(id: DatabaseCloseRequest['id']) {
    const closeRequest = this.getCloseRequest(id);
    if (closeRequest) await closeRequest.updateMessageButtons(true);
    this.db.prepare<DatabaseCloseRequest['id']>('DELETE FROM closeRequests WHERE id = ?').run(id);
  }

  getSupportTeam(id: DatabaseSupportTeam['id']): SupportTeam | undefined {
    const data = this.db
      .prepare<[DatabaseSupportTeam['id']], DatabaseSupportTeam>('SELECT * FROM supportTeams WHERE id = ?')
      .get(id);
    if (!data) return data;
    return new SupportTeam(data, this);
  }

  getSupportTeams(filters: SupportTeamSearchFilters = {}): SupportTeam[] {
    return this.db
      .prepare<
        {
          supportRole: DatabaseSupportTeam['supportRole'] | null;
          ticketPingRole: DatabaseSupportTeam['ticketPingRole'] | null;
          limit: number;
        },
        DatabaseSupportTeam
      >(
        'SELECT * FROM supportTeams WHERE (@supportRole IS NULL OR supportRole = @supportRole) AND (@ticketPingRole IS NULL OR ticketPingRole = @ticketPingRole) LIMIT @limit'
      )
      .all({
        supportRole: filters.supportRole ?? null,
        ticketPingRole: filters.ticketPingRole ?? null,
        limit: filters.limit ?? -1
      })
      .map((data) => new SupportTeam(data, this));
  }

  insertSupportTeam(data: Omit<DatabaseSupportTeam, 'id'>): SupportTeam {
    const id: DatabaseSupportTeam['id'] = crypto.randomUUID();
    this.db
      .prepare<DatabaseSupportTeam>(
        'INSERT INTO supportTeams (id, name, supportRole, ticketPingRole) VALUES (@id, @name, @supportRole, @ticketPingRole)'
      )
      .run({ ...data, id });
    return new SupportTeam({ ...data, id }, this);
  }

  updateSupportTeam(data: DatabaseSupportTeam): SupportTeam {
    const update = this.db
      .prepare<DatabaseSupportTeam>(
        'UPDATE supportTeams SET name = @name, supportRole = @supportRole, ticketPingRole = @ticketPingRole WHERE id = @id'
      )
      .run(data);
    if (update.changes === 0) throw new PolyHelperError('Could not find this support team?');
    return new SupportTeam(data, this);
  }

  async deleteSupportTeam(id: DatabaseSupportTeam['id']) {
    const supportTeam = this.getSupportTeam(id);
    if (supportTeam) {
      const panels = supportTeam.getPanels();
      for (const panel of panels) await this.updatePanel({ ...panel.toJSON(), supportTeamId: null });
    }
    this.db.prepare<DatabaseCloseRequest['id']>('DELETE FROM supportTeams WHERE id = ?').run(id);
  }
}

export default DatabaseManager;
