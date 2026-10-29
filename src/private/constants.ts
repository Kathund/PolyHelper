import type { CreditData, DevData } from '../types/application.ts';
import type { EmbedStyleData } from '../types/discord.ts';

export const EmbedStyles = {
  Generic: { color: 'Blue' },
  Warning: { author: { name: 'An Warning has occurred' }, color: 'Yellow' },
  Error: { author: { name: 'An Error has occurred' }, color: 'Red' },
  Success: { author: { name: 'Success' }, color: 'Green' },
  DataInfo: { title: 'Showing Data', color: 'Pink', footer: 'Amber', footerMessage: 'Last Updated', timestamp: 'Now' }
} satisfies Record<string, EmbedStyleData>;

export const CommonDevs = {
  Amber: {
    displayName: 'Amber',
    githubUsername: 'kathund',
    type: 'Maintainer',
    avatarURL: 'https://kathund.dev/kathund.png',
    discord: { username: 'amber.rip', id: '1276524855445164098' },
    note: ':purple_heart:'
  },
  KTibow: { displayName: 'KTibow', githubUsername: 'KTibow', type: 'Contributor' },
  Lunaynx: {
    displayName: 'Luna',
    githubUsername: 'KTibow',
    type: 'Contributor',
    avatarURL: 'https://cdn.discordapp.com/avatars/1080661733531729940/4782a3b36c9a07ebb9e7352e315872cd.png?size=4096',
    discord: { username: 'lunaynx', id: '1080661733531729940' }
  },
  Ruin: {
    displayName: 'Fayne',
    githubUsername: 'RuinTD',
    type: 'Maintainer',
    avatarURL: 'https://cdn.discordapp.com/avatars/157917665162297344/d2951bb98e7267a2a587fd812d6c2db4.png?size=4096',
    discord: { username: 'ruintd', id: '157917665162297344' }
  },
  Wyvest: {
    displayName: 'Wyvest',
    githubUsername: 'Wyvest',
    type: 'Contributor',
    avatarURL: 'https://cdn.discordapp.com/avatars/647041687541121044/f8c7038ccdac490b676281bba2793670.png?size=4096',
    discord: { username: 'wyvest', id: '647041687541121044' }
  }
} satisfies Record<string, DevData>;

export const MiscCredits: CreditData[] = [
  { name: 'discord.js', description: 'Handles the discord part of this project', link: 'discord.js.org' }
];

export function parseMiscCredit({ name, description, link }: CreditData): string {
  return `- **[${name}](<https://${link}>):** ${description}`;
}

export function parseMiscCredits(credits: CreditData[]): string[] {
  return credits.map((line) => parseMiscCredit(line));
}

export function getParsedMiscCredits(): string[] {
  return parseMiscCredits(MiscCredits);
}
