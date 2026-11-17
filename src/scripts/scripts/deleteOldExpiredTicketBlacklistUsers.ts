import BasicScript from '../BasicScript.ts';
import ms from 'ms';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class DeleteOldExpiredTicketBlacklistUsersScript extends BasicScript {
  private readonly expirationThreshold = ms('90d');
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'deleteOldExpiredTicketBlacklistUsers', interval: '1h' });
  }

  override execute() {
    const expirationDate = Date.now() - this.expirationThreshold;
    const ticketBlacklistUsers = this.scripts.application.database.getTicketBlacklistUsers({ active: false });
    for (const ticketBlacklistUser of ticketBlacklistUsers) {
      if (ticketBlacklistUser.lastUpdated >= expirationDate) continue;
      try {
        this.scripts.application.database.deleteTicketBlacklistUser(ticketBlacklistUser.id);
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Ticket Blacklist User Id', value: ticketBlacklistUser.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default DeleteOldExpiredTicketBlacklistUsersScript;
