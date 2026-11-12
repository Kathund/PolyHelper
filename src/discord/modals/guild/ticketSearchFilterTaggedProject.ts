import Application from '../../../Application.ts';
import BasicInteractionMetadata from '../../private/interactions/basic/BasicInteractionMetadata.ts';
import DiscordModal from '../../private/interactions/DiscordModal.ts';
import PolyHelperError from '../../../private/error.ts';
import {
  ActionRowBuilder,
  type ModalMessageModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder
} from 'discord.js';
import { InteractionFlag, InteractionResponse, type InteractionWithGuild } from '../../../types/discord.ts';
import { getSearchContainer } from '../../private/ComponentHelper.ts';
import type { TicketSearch } from '../../../types/misc.ts';

class TicketSearchFilterTaggedProjectModal extends DiscordModal {
  override readonly metadata: BasicInteractionMetadata = new BasicInteractionMetadata('ticketSearchFilterTaggedProject')
    .setFlags(InteractionFlag.RequiresGuild)
    .setResponse(InteractionResponse.Update)
    .setFetchGuildMember(false);

  override async execute(interaction: InteractionWithGuild<ModalMessageModalSubmitInteraction>) {
    const [id] = this.getArgs(interaction);
    if (id === undefined) throw new PolyHelperError('Could not find the ticket search ID');
    const filters = Application.cache.get<TicketSearch>(`ticket:search:${id}`);
    if (!filters) throw new PolyHelperError('These ticket search filters have expired. Run the search again.');

    const possibleProjects = this.discord.application.database.searchProjectNames(
      interaction.fields.getTextInputValue('project')
    );
    if (possibleProjects.length === 0) {
      throw new PolyHelperError('Could not find any possible projects from your input');
    }

    if (possibleProjects.length === 1 && possibleProjects[0] !== undefined) {
      const project = this.discord.application.database.getProject(possibleProjects[0].id);
      if (!project) throw new PolyHelperError('Does this project exist?');
      filters.taggedProjectId = project.id;
      Application.cache.set<TicketSearch>(`ticket:search:${id}`, filters);
      return await interaction.editReply({
        components: [
          getSearchContainer(
            filters,
            this.discord.application.database.getPanels(),
            filters.taggedProjectId ? this.discord.application.database.getProject(filters.taggedProjectId) : undefined,
            id
          )
        ]
      });
    }

    await interaction.editReply({
      components: [
        new TextDisplayBuilder().setContent('# Select the project'),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(interaction.customId)
            .setPlaceholder('Select a project')
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
              possibleProjects
                .slice(0, 25)
                .map((project) => new StringSelectMenuOptionBuilder().setLabel(project.name).setValue(project.id))
            )
        )
      ]
    });
  }
}

export default TicketSearchFilterTaggedProjectModal;
