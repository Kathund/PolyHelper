import BasicScript from '../BasicScript.ts';
import PolyHelperError from '../../private/error.ts';
import ms from 'ms';
import prettyMilliseconds from 'pretty-ms';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class CloseEmptyTicketsScript extends BasicScript {
  private readonly expirationThreshold = ms('12h');
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'closeEmptyTickets', interval: '5m' });
  }

  override async execute() {
    if (!this.scripts.application.discord.isClientOnline()) {
      throw new PolyHelperError("The discord bot doesn't seam to be online? Please restart the application");
    }
    const expirationDate = Date.now() - this.expirationThreshold;
    const tickets = this.scripts.application.database.getTickets({
      closed: false,
      pinned: false,
      autoClose: false,
      hasMessageFromOwner: false
    });
    for (const ticket of tickets) {
      if (ticket.lastUpdated >= expirationDate) continue;
      try {
        await ticket.close({
          reason: `No message from user after ${prettyMilliseconds(this.expirationThreshold)}. Auto-closing...`,
          executor: this.scripts.application.discord.client.user
        });
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Ticket Id', value: ticket.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default CloseEmptyTicketsScript;
