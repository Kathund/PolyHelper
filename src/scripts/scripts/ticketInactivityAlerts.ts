import BasicScript from '../BasicScript.ts';
import ms from 'ms';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class TicketInactivityAlertsScript extends BasicScript {
  private readonly inactivityThreshold = ms('2m');
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'ticketInactivityAlerts', interval: '1m' });
  }

  override async execute() {
    const now = Date.now();
    const tickets = this.scripts.application.database.getTickets({ closed: 0, pinned: false, silenced: false });
    for (const ticket of tickets) {
      try {
        if (ticket.lastMessageTimestamp === null || now - ticket.lastMessageTimestamp < this.inactivityThreshold) continue;
        const inactivity = await ticket.getInactivityMessage();
        if (inactivity) continue;
        await ticket.sendInactivityNotice();
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Ticket Id', value: ticket.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default TicketInactivityAlertsScript;
