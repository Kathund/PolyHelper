import ms from 'ms';
import prettyMilliseconds from 'pretty-ms';
import { schedule } from 'node-cron';
import { toError } from '../utils/miscUtils.ts';
import type ScriptManager from './ScriptManager.ts';
import type { ScriptOptions } from '../types/scripts.ts';

abstract class BasicScript {
  id: string;
  cron?: string;
  interval?: number;
  enabled: boolean = true;
  constructor(
    protected readonly scripts: ScriptManager,
    options: ScriptOptions
  ) {
    const { id, cron, interval, enabled } = options;
    this.id = id;
    this.cron = cron;
    this.interval = interval ? ms(interval) : undefined;
    this.enabled = enabled ?? this.enabled;
    this.init();
  }

  abstract execute(): Promise<any> | void;

  async runNow(): Promise<number> {
    return await this.run();
  }

  private async run() {
    const start = performance.now();
    try {
      await this.execute();
    } catch (error) {
      this.scripts.application.logError(toError(error), [{ name: 'Script Id', value: this.id, format: 'Block' }]);
    } finally {
      return performance.now() - start;
    }
  }

  private init() {
    if (!this.enabled) return console.scripts(`Script \`${this.id}\` is disabled.`);
    if (this.interval) {
      console.scripts(
        `Loaded script \`${this.id}\` - executing every ${this.interval}ms (${prettyMilliseconds(this.interval)})`
      );
      setInterval(() => this.run(), this.interval);
    } else if (this.cron) {
      console.scripts(`Loaded script \`${this.id}\` - executing with cron: ${this.cron}.`);
      schedule(this.cron, () => this.run(), { timezone: 'UTC' });
    } else {
      console.scripts(`Loaded script \`${this.id}\` - No execute set`);
    }
  }
}

export default BasicScript;
