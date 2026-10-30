import BasicScript from '../BasicScript.ts';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class TicketInactivityAlertsScript extends BasicScript {
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'ticketInactivityAlerts' });
  }

  override async execute() {
    const openTickets = this.scripts.application.database.getTickets({ closed: 0, pinned: false });

    for (const ticket of openTickets) {
      try {
        const nextAlertAt = ticket.nextInactivityAlertAt;
        if (nextAlertAt === null || nextAlertAt > Date.now()) continue;
        if (ticket.linkedCloseRequest) continue;
        await ticket.sendInactivityAlert();
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
