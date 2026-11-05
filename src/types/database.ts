import zod from 'zod';

export interface DatabaseMigrationFile {
  start: number;
  end: number;
  path: string;
}

export interface MetadataEntry<K extends string> {
  key: K;
  value: string;
}

export interface DatabaseSearchFilters<Sort extends string = 'LastUpdated'> {
  limit?: number;
  sort?: Sort | 'LastUpdated' | 'None';
  sortDirection?: 'ASC' | 'DESC';
}

export const BaseDatabaseItem = zod.object({ id: zod.string(), lastUpdated: zod.int().positive() });
export type BaseDatabaseItem = zod.infer<typeof BaseDatabaseItem>;

export const DatabaseBoolean = zod
  .union([zod.literal(0), zod.literal(1)])
  .meta({ description: "Boolean type isn't support by sql so we need to use 0 1 as a boolean" });

export const DatabasePanel = BaseDatabaseItem.extend({
  name: zod.string(),
  title: zod.string(),
  description: zod.string(),
  buttonLabel: zod.string(),
  buttonEmoji: zod.string().nullable(),
  buttonStyle: zod.union([zod.literal(1), zod.literal(2), zod.literal(3), zod.literal(4)]),
  openingMessage: zod.string(),
  openingMessageContent: zod.string(),
  openingMessageTitle: zod.string(),
  maxOpenTickets: zod.int().positive(),
  pinnedTicketPrefix: zod.string(),
  closedTicketPrefix: zod.string(),
  defaultTicketName: zod.string(),
  pingSupportTeamOnOpen: DatabaseBoolean,
  supportTeamId: zod.string().nullable(),
  enabled: DatabaseBoolean
});
export type DatabasePanel = zod.infer<typeof DatabasePanel>;

export interface PanelSearchFilters extends DatabaseSearchFilters {
  enabled?: boolean;
  supportTeamId?: DatabasePanel['supportTeamId'];
}

export const DatabaseTicket = BaseDatabaseItem.extend({
  panelId: zod.string(),
  threadId: zod.string(),
  owner: zod.string(),
  pinMessageId: zod.string().nullable(),
  startingMessageId: zod.string(),
  openingTimestamp: zod.int().positive(),
  lastMessageTimestamp: zod.int().positive().nullable(),
  inactivityNoticeId: zod.string().nullable(),
  inactivitySilenced: DatabaseBoolean,
  name: zod.string(),
  taggedProject: zod.string().nullable(),
  closedBy: zod.string().nullable(),
  closedReason: zod.string().nullable(),
  closed: DatabaseBoolean
});
export type DatabaseTicket = zod.infer<typeof DatabaseTicket>;
export type InsertDatabaseTicketFields =
  | keyof BaseDatabaseItem
  | 'pinMessageId'
  | 'openingTimestamp'
  | 'lastMessageTimestamp'
  | 'inactivityNoticeId'
  | 'inactivitySilenced'
  | 'taggedProject'
  | 'closedBy'
  | 'closedReason'
  | 'closed';

export interface TicketSearchFilters extends DatabaseSearchFilters<'OpeningTimestamp' | 'LastMessageTimestamp'> {
  panelId?: DatabaseTicket['panelId'];
  owner?: DatabaseTicket['owner'];
  pinned?: boolean;
  inactivitySilenced?: boolean;
  closed?: boolean;
  autoClose?: boolean;
  taggedProject?: Exclude<DatabaseTicket['taggedProject'], null>;
  closedBy?: Exclude<DatabaseTicket['taggedProject'], null>;
}

export const DatabaseCloseRequest = BaseDatabaseItem.extend({
  ticketId: zod.string(),
  messageId: zod.string(),
  reason: zod.string(),
  closer: zod.string(),
  autoClose: zod.int().positive().nullable()
});
export type DatabaseCloseRequest = zod.infer<typeof DatabaseCloseRequest>;

export interface CloseRequestSearchFilters extends DatabaseSearchFilters<'AutoClose'> {
  closer?: DatabaseCloseRequest['closer'];
  hasAutoClose?: boolean;
}

export const DatabaseSupportTeam = BaseDatabaseItem.extend({
  name: zod.string(),
  supportRole: zod.string(),
  ticketPingRole: zod.string()
});
export type DatabaseSupportTeam = zod.infer<typeof DatabaseSupportTeam>;

export interface SupportTeamSearchFilters extends DatabaseSearchFilters {
  supportRole?: DatabaseSupportTeam['supportRole'];
  ticketPingRole?: DatabaseSupportTeam['ticketPingRole'];
}

export type DatabaseItem = DatabaseCloseRequest | DatabasePanel | DatabaseSupportTeam | DatabaseTicket;
