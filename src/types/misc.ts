import type { ChalkInstance } from 'chalk';
import type { PartialUser, User } from 'discord.js';
import type { TicketSearchFilters } from './database.ts';

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

export type TicketSearch = Omit<TicketSearchFilters, 'limit' | 'autoClose'>;

export type TemplatePrimitive = string | number | boolean | null | undefined;
