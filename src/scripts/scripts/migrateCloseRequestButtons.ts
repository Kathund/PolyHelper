import BasicScript from '../BasicScript.ts';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class MigrateCloseRequestButtonsScript extends BasicScript {
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'migrateCloseRequestButtons' });
  }

  override async execute() {
    const closeRequests = this.scripts.application.database.getCloseRequests();

    for (const closeRequest of closeRequests) {
      try {
        await closeRequest.updateMessageButtons();
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Close Request Id', value: closeRequest.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default MigrateCloseRequestButtonsScript;
