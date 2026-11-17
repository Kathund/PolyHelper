import BasicScript from '../BasicScript.ts';
import CloseRequest from '../../database/private/CloseRequest.ts';
import EmbedHelper from '../../discord/private/EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import { toError } from '../../utils/miscUtils.ts';
import type ScriptManager from '../ScriptManager.ts';
import type { GuildMember } from 'discord.js';

class CheckCloseRequestsScript extends BasicScript {
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'checkCloseRequests', interval: '1m' });
  }

  private async getCloser(closeRequest: CloseRequest): Promise<GuildMember> {
    if (!this.scripts.application.discord.isGuildReady()) {
      throw new PolyHelperError('Something went wrong loading the guild');
    }
    try {
      return await closeRequest.getCloserDiscord();
    } catch (error) {
      this.scripts.application.logError(toError(error), [
        { name: 'Script Id', value: this.id, format: 'Block' },
        { name: 'Close Request Id', value: closeRequest.id, format: 'Block' },
        { name: 'Closer Id', value: closeRequest.closer, format: 'Block' }
      ]);
      return await this.scripts.application.discord.guild.members.fetchMe();
    }
  }

  override async execute() {
    const closeRequests = this.scripts.application.database.getCloseRequestByAutoClose();
    for (const closeRequest of closeRequests) {
      try {
        const ticket = closeRequest.ticket;
        if (ticket.pinned) {
          await this.scripts.application.database.deleteCloseRequest(closeRequest.id);
          continue;
        }
        const message = await closeRequest.getMessage();
        await message.reply({
          embeds: [
            new EmbedHelper().setTitle('Closing').setDescription('This close request has expired. Auto-closing...')
          ]
        });
        const guildMember = await this.getCloser(closeRequest);
        await ticket.close({ reason: closeRequest.reason, executor: guildMember.user });
      } catch (error) {
        this.scripts.application.logError(toError(error), [
          { name: 'Script Id', value: this.id, format: 'Block' },
          { name: 'Close Request Id', value: closeRequest.id, format: 'Block' }
        ]);
      }
    }
  }
}

export default CheckCloseRequestsScript;
