import type { ChalkInstance } from 'chalk';
import type { PartialUser, User } from 'discord.js';

declare global {
  export interface Console {
    discord: (message: string) => void;
    scripts: (message: string) => void;
    other: (message: string) => void;
  }
}

export interface LogData {
  level: string;
  background: ChalkInstance;
  color: ChalkInstance;
}

export interface TicketAction {
  reason?: string;
  executor: User | PartialUser;
}

export interface TicketSearch {
  panelId?: string;
  pinned?: boolean;
  unpinned?: boolean;
  closed?: boolean;
  open?: boolean;
  owner?: string;
}

export type TemplatePrimitive = string | number | boolean | null | undefined;
