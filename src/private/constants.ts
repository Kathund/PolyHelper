import type { CreditData, DevData } from '../types/application.ts';
import type { EmbedStyleData } from '../types/discord.ts';

export const EmbedStyles = {
  Generic: { color: 'Blue' },
  Warning: { author: { name: 'An Warning has occurred' }, color: 'Yellow' },
  Error: { author: { name: 'An Error has occurred' }, color: 'Red' },
  Success: { author: { name: 'Success' }, color: 'Green' },
  DataInfo: {
    title: 'Showing Data',
    color: 'Pink',
    footer: 'Amber',
    footerMessage: 'Embed Last Updated',
    timestamp: 'Now'
  }
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
  Wyvest: {
    displayName: 'Wyvest',
    githubUsername: 'Wyvest',
    type: 'Contributor',
    avatarURL: 'https://cdn.discordapp.com/avatars/647041687541121044/f8c7038ccdac490b676281bba2793670.png?size=4096',
    discord: { username: 'wyvest', id: '647041687541121044' }
  },
  Deftu: {
    displayName: 'Deftu',
    githubUsername: 'Deftu',
    type: 'Contributor',
    avatarURL: 'https://cdn.discordapp.com/avatars/982012892285128845/46eebaf733b7074ef0324bfb94f9e3e5.png?size=4096',
    discord: { username: 'deftu', id: '982012892285128845' }
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
