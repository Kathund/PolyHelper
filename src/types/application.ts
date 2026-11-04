import type PolyHelperError from '../private/error.ts';
import type { CommonDevs } from '../private/constants.ts';
import type { DiscordjsError } from 'discord.js';

export type DevName = keyof typeof CommonDevs;
export const DevTypes = ['Maintainer', 'Contributor'] as const;
export type DevType = (typeof DevTypes)[number];

export interface DevDiscordData {
  username: string;
  id: string;
}

export interface BasicDevData {
  displayName: string;
  githubUsername: string;
  avatarURL?: string;
  discord?: DevDiscordData;
  note?: string;
}

export interface MaintainerDevData extends BasicDevData {
  type: 'Maintainer';
  avatarURL: string;
  discord: DevDiscordData;
}

export interface ContributorDevData extends BasicDevData {
  type: 'Contributor';
}

export type DevData = MaintainerDevData | ContributorDevData;

export interface CreditData {
  name: string;
  description: string;
  link: string;
}

export type ValidErrors = Error | DiscordjsError | PolyHelperError;

export interface RuntimeInformation {
  commit: string;
  dirty: boolean;
  startTime: number;
  docker: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextPage: string | null;
}
