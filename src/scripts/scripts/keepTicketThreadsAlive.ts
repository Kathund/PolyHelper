import BasicScript from '../BasicScript.ts';
import ms from 'ms';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class KeepTicketThreadsAliveScript extends BasicScript {
  private readonly nextCheckAt = new Map<string, number>();
  private readonly threadArchiveDelay = ms('5m');
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'keepTicketThreadsAlive', interval: '1m' });
  }

  override async execute() {
    const openTickets = this.scripts.application.database.getTickets({
      closed: false,
      sort: 'LastUpdated',
      sortDirection: 'ASC'
    });

    for (const ticket of openTickets) {
      try {
        const thread = await ticket.getThread();
        const nextCheckAt = this.nextCheckAt.get(thread.id);
        if (!thread.archived && nextCheckAt !== undefined && nextCheckAt > Date.now()) continue;
        const nextDuration = await ticket.refreshThread();
        if (nextDuration === undefined) continue;
        this.nextCheckAt.set(thread.id, Date.now() + ms(`${nextDuration}m`) - this.threadArchiveDelay);
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Ticket Id', value: ticket.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default KeepTicketThreadsAliveScript;
