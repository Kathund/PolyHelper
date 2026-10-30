import PolyHelperError from '../../private/error.ts';
import assert from 'node:assert';
import { type BaseInteraction, Collection } from 'discord.js';
import { InteractionFlag, InteractionPermission, type InteractionTypes } from '../../types/discord.ts';
import {
  convertInteractionTypeToHuman,
  isAdminMember,
  isApplicationOwner,
  isInteractionInsideOfGuild,
  isModeratorMember,
  isPolyfrostTeamMember,
  isSupportMember
} from '../../utils/discordUtils.ts';
import { toError } from '../../utils/miscUtils.ts';
import type BasicInteractionData from './interactions/basic/BasicInteractionData.ts';
import type DiscordManager from '../DiscordManager.ts';

abstract class BasicInteractionHandler<
  Interaction extends InteractionTypes,
  ElementData extends BasicInteractionData<Interaction, any>
> {
  readonly elements: Collection<string, ElementData> = new Collection<string, ElementData>();
  constructor(protected readonly discord: DiscordManager) {}

  abstract getRawIdFromInteraction(interaction: Interaction): string;

  getIdFromInteraction(interaction: Interaction): string {
    return this.getRawIdFromInteraction(interaction);
  }

  abstract handleResponse(interaction: Interaction, element: ElementData): Promise<any>;

  // eslint-disable-next-line require-await
  async beforeExectue(interaction: Interaction, element: ElementData): Promise<boolean> {
    return false;
  }

  async onInteraction(interaction: Interaction) {
    const element = this.elements.get(this.getIdFromInteraction(interaction));
    if (!element) return;

    try {
      await this.handleResponse(interaction, element);

      console.discord(
        `Interaction ${convertInteractionTypeToHuman(interaction.type)} triggered by @${interaction.user.username} (${interaction.user.id}) | ${this.getIdFromInteraction(interaction)} (${this.getRawIdFromInteraction(interaction)})`
      );

      this.checkInteractionFlags(interaction, element.metadata.flags);
      await this.checkPermission(interaction, element.metadata.permission);

      if (element.metadata.flags.includes(InteractionFlag.RequiresGuild)) {
        assert(interaction.guild);
        if (element.metadata.fetchGuildMember) {
          interaction.member = await interaction.guild.members.fetch(interaction.user.id);
        }
      }

      const shouldReturn = await this.beforeExectue(interaction, element);
      if (shouldReturn) return;

      await element.execute(interaction);
    } catch (error) {
      await this.discord.handleError(toError(error), interaction, [], element.metadata);
    }
  }

  abstract loadElements(): Promise<unknown>;

  async checkPermission(interaction: BaseInteraction, permission: InteractionPermission) {
    const [
      isApplicationOwnerCheck,
      isAdminMemberCheck,
      isPolyfrostTeamMemberCheck,
      isModeratorMemberCheck,
      isSupportMemberCheck
    ] = await Promise.all([
      permission === InteractionPermission.Owner ? isApplicationOwner(interaction.user) : false,
      permission === InteractionPermission.Admin ? isAdminMember(interaction.member) : false,
      permission === InteractionPermission.PolyfrostTeam ? isPolyfrostTeamMember(interaction.member) : false,
      permission === InteractionPermission.Moderator ? isModeratorMember(interaction.member) : false,
      permission === InteractionPermission.Support ? isSupportMember(interaction.member) : false
    ]);

    const checks: Array<[boolean, string]> = [
      [
        permission === InteractionPermission.Owner && !isApplicationOwnerCheck,
        "You don't have permission to use this command. You are required to own the bot."
      ],
      [
        permission === InteractionPermission.Admin && !isAdminMemberCheck,
        "You don't have permission to use this command. You are required to be an admin."
      ],
      [
        permission === InteractionPermission.PolyfrostTeam && !isPolyfrostTeamMemberCheck,
        "You don't have permission to use this command. You are required to be appart of the Polyfrost Team."
      ],
      [
        permission === InteractionPermission.Moderator && !isModeratorMemberCheck,
        "You don't have permission to use this command. You are required to be appart of the Moderation Team."
      ],
      [
        permission === InteractionPermission.Support && !isSupportMemberCheck,
        "You don't have permission to use this command. You are required to be appart of the Support Team."
      ]
    ];

    for (const [failed, message] of checks) if (failed) throw new PolyHelperError(message);
  }

  checkInteractionFlags(interaction: Interaction, flags: InteractionFlag[]) {
    const checks: Array<[boolean, string]> = [
      [
        flags.includes(InteractionFlag.RequiresGuild) && !isInteractionInsideOfGuild(interaction),
        'Please run this interaction inside of a guild.'
      ]
    ];

    for (const [failed, message] of checks) if (failed) throw new PolyHelperError(message);
  }
}

export default BasicInteractionHandler;
