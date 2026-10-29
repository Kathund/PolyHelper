import BasicInteractionMetadata from './BasicInteractionMetadata.ts';
import PolyHelperError from '../../../../private/error.ts';
import type Ticket from '../../../../database/private/Ticket.ts';
import type { BaseInteraction } from 'discord.js';
import type { CustomIdInteraction, DiscordManagerWithClient, InteractionWithGuild } from '../../../../types/discord.ts';

abstract class BasicInteractionData<
  Interaction extends BaseInteraction,
  Metadata extends object = BasicInteractionMetadata
> {
  abstract readonly metadata: Metadata;
  constructor(protected readonly discord: DiscordManagerWithClient) {}

  protected getArgs(interaction: CustomIdInteraction): string[] {
    if (!(this.metadata instanceof BasicInteractionMetadata)) throw new PolyHelperError('Unsupported interaction data');
    const split = interaction.customId.split(':');
    const id = split[0];
    if (!id) throw new PolyHelperError('Could not get the args of this interaction');
    if (!this.metadata.ids.includes(id)) throw new PolyHelperError('Could not get the args of this interaction');
    return split.slice(1);
  }

  getTicket(interaction: InteractionWithGuild<Interaction>): Ticket {
    const ticket = this.discord.application.database.getTicketByThreadId(interaction.channel.id);
    if (!ticket) throw new PolyHelperError('This is not a ticket. Please run this command inside of a ticket');
    return ticket;
  }

  abstract execute(interaction: Interaction): Promise<any>;
}

export default BasicInteractionData;
