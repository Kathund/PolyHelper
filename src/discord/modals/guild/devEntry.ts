import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import { InteractionFlag, type InteractionWithGuild } from '../../../types/discord.ts';
import { getRepoCount } from '../../../utils/githubUtils.ts';
import { hasRole } from '../../../utils/discordUtils.ts';
import type { ModalMessageModalSubmitInteraction } from 'discord.js';

class DevEntryModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('dev-entry').setFlags(
    InteractionFlag.RequiresGuild
  );

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    if (await hasRole(interaction.member, this.discord.application.config.discord.roles.devAccess)) {
      throw new PolyHelperError('You already have access to the Development channels');
    }

    const userAnswer = parseInt(interaction.fields.getTextInputValue('repo-count'));
    const answer = await getRepoCount();

    if (userAnswer !== answer) return await interaction.followUp({ content: 'Your answer was incorrect. Try again.' });

    await interaction.member.roles.add(
      this.discord.application.config.discord.roles.devAccess,
      'User parsed the dev entry question'
    );
    await interaction.followUp({ content: 'You should now have access to the Development channels.' });
  }
}

export default DevEntryModal;
