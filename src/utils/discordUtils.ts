import {
  type APIGuildMember,
  type APIInteractionDataResolvedGuildMember,
  type APIInteractionGuildMember,
  BaseChannel,
  type BaseInteraction,
  ButtonStyle,
  type Channel,
  type Client,
  GuildMember,
  InteractionType,
  Role,
  type SendableChannels,
  Team,
  User
} from 'discord.js';
import type { DiscordUser, InteractionWithGuild } from '../types/discord.ts';

export async function getRoles(member: GuildMember): Promise<Role[]> {
  member = await member.fetch();
  return member.roles.cache.map((role) => role);
}

export async function hasRole(member: GuildMember, roleId: Role['id']): Promise<boolean> {
  const userRoles = await getRoles(member).then((roles) => roles.map((role) => role.id));
  return userRoles.includes(roleId);
}

export async function getApplicationOwners(client: Client<true>): Promise<string[]> {
  const app = await client.application.fetch();
  if (app.owner instanceof Team) return app.owner.members.map((member) => member.id);
  return app.owner?.id ? [app.owner.id] : [];
}

export async function isApplicationOwner(user: User): Promise<boolean> {
  const adminUsers = await getApplicationOwners(user.client);
  return adminUsers.includes(user.id);
}

export function isDiscordServerOwner(user: User): boolean {
  if (!user.client.discordManager.isGuildReady()) return false;
  return user.id === user.client.discordManager.guild.ownerId;
}

export function isGuildMember(
  member:
    GuildMember | APIGuildMember | APIInteractionGuildMember | APIInteractionDataResolvedGuildMember | null | undefined
): member is GuildMember {
  return member instanceof GuildMember;
}

export function normalizeGuildMember(input: DiscordUser): Exclude<DiscordUser, GuildMember> {
  if (input instanceof GuildMember) return input.user;
  return input;
}

export async function isAdminMember(member: GuildMember | APIInteractionGuildMember | null): Promise<boolean> {
  if (!isGuildMember(member)) return false;
  if (member.permissions.has('Administrator')) return true;
  if (await isApplicationOwner(member.user)) return true;
  if (isDiscordServerOwner(member.user)) return true;
  return false;
}

export async function isPolyfrostTeamMember(member: GuildMember | APIInteractionGuildMember | null): Promise<boolean> {
  if (!isGuildMember(member)) return false;
  if (await isAdminMember(member)) return true;
  return await hasRole(member, member.client.discordManager.application.config.discord.roles.polyfrostTeam);
}

export async function isModeratorMember(member: GuildMember | APIInteractionGuildMember | null): Promise<boolean> {
  if (!isGuildMember(member)) return false;
  if (await isPolyfrostTeamMember(member)) return true;
  return await hasRole(member, member.client.discordManager.application.config.discord.roles.moderator);
}

export async function isSupportMember(member: GuildMember | APIInteractionGuildMember | null): Promise<boolean> {
  if (!isGuildMember(member)) return false;
  if (await isModeratorMember(member)) return true;
  return await hasRole(member, member.client.discordManager.application.config.discord.roles.support);
}

export function isInteractionInsideOfGuild<Interaction extends BaseInteraction>(
  interaction: Interaction
): interaction is InteractionWithGuild<Interaction> {
  return interaction.guild !== null && interaction.member !== null;
}

export async function canSendMessages(channel: SendableChannels): Promise<boolean> {
  return await channel
    .sendTyping()
    .then(() => true)
    .catch((error: Error) => {
      if (error.message === 'Missing Access') return false;
      throw error;
    });
}

export function convertInteractionTypeToHuman(type: InteractionType): string {
  switch (type) {
    case InteractionType.ApplicationCommand:
      return 'ApplicationCommand';
    case InteractionType.MessageComponent:
      return 'MessageComponent';
    case InteractionType.ApplicationCommandAutocomplete:
      return 'ApplicationCommandAutocomplete';
    case InteractionType.ModalSubmit:
      return 'ModalSubmit';
    case InteractionType.Ping:
    default:
      return 'Ping';
  }
}

export function getFormattedBooleanResponse(value: boolean): string {
  return value ? ':white_check_mark: Yes' : ':x: No';
}

export function getUserDisplayName(input: DiscordUser, id: boolean = true): string {
  const user = normalizeGuildMember(input);
  return `@${user.username} ${id ? `(${user.id})` : ''}`.trim();
}

export function getFullUserDisplayName(input: DiscordUser, id: boolean = true): string {
  const user = normalizeGuildMember(input);
  return `${user.globalName ?? `@${user.username}`} ${id ? `(${user.id})` : ''}`.trim();
}

export function getId(input: DiscordUser | Role | Channel | BaseChannel | string): string {
  if (typeof input === 'string') return input;
  return input.id;
}

export function getMention(
  input: DiscordUser | Role | Channel | BaseChannel,
  type: 'Role' | 'Channel' | 'User' = 'User'
): string {
  if (type === 'Role' || input instanceof Role) return `<@&${getId(input)}>`;
  if (type === 'Channel' || input instanceof BaseChannel) return `<#${getId(input)}>`;
  return `<@${getId(input)}>`;
}

export function convertButtonStyleToHuman(style: ButtonStyle): string {
  switch (style) {
    case ButtonStyle.Secondary:
      return 'Secondary';
    case ButtonStyle.Success:
      return 'Success';
    case ButtonStyle.Danger:
      return 'Danger';
    case ButtonStyle.Link:
      return 'Link';
    case ButtonStyle.Premium:
      return 'Premium';
    case ButtonStyle.Primary:
    default:
      return 'Primary';
  }
}
