import BasicInteractionData from '../basic/BasicInteractionData.ts';
import { type AutocompleteOption, InteractionResponse } from '../../../../types/discord.ts';
import { getReason, titleCaseFromCamel } from '../../../../utils/stringUtils.ts';
import type DiscordCommandMetadata from './DiscordCommandMetadata.ts';
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

abstract class DiscordCommand extends BasicInteractionData<ChatInputCommandInteraction, DiscordCommandMetadata> {
  shouldEphemeral(interaction: ChatInputCommandInteraction): boolean {
    return (
      interaction.options.getBoolean('hidden-response') ?? this.metadata.response === InteractionResponse.Ephemeral
    );
  }

  protected getReason(interaction: ChatInputCommandInteraction, required: boolean = false) {
    return getReason(interaction.options.getString('reason', required));
  }

  // eslint-disable-next-line require-await
  async autocomplete(interaction: AutocompleteInteraction): Promise<AutocompleteOption[]> {
    const focusedOption = interaction.options.getFocused(true);

    switch (focusedOption.name) {
      case 'ticket-id':
        return this.discord.application.database
          .getTickets({ limit: 25 })
          .map((ticket) => ticket.toAutocompleteOption());
      case 'closed-ticket-id':
        return this.discord.application.database
          .getTickets({ closed: 1, limit: 25 })
          .map((ticket) => ticket.toAutocompleteOption());
      case 'panel-id':
        return this.discord.application.database.getPanels({ limit: 25 }).map((panel) => panel.toAutocompleteOption());
      case 'support-team-id':
        return this.discord.application.database
          .getSupportTeams({ limit: 25 })
          .map((panel) => panel.toAutocompleteOption());
      case 'script-name':
        return this.discord.application.scripts.scripts
          .map(({ id }) => ({ value: id, name: titleCaseFromCamel(id) }))
          .sort((a, b) => a.name.localeCompare(b.name));
      default:
        return [{ name: 'No Values Found', value: 'UNKNOWN' }];
    }
  }
}

export default DiscordCommand;
