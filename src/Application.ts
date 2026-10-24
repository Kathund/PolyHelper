import CacheHandler from './private/CacheHandler.ts';
import DatabaseManager from './database/DatabaseManager.ts';
import DiscordManager from './discord/DiscordManager.ts';
import PolyHelperError from './private/error.ts';
import ScriptManager from './scripts/ScriptManager.ts';
import SparkManager from './spark/SparkManager.ts';
import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import packageJson from '../package.json' with { type: 'json' };
import { canSendMessages } from './utils/discordUtils.ts';
import { execSync } from 'node:child_process';
import { getErrorTypeName, getFullErrorEmbed } from './utils/miscUtils.ts';
import type { Config } from './types/config.ts';
import type { EmbedHelperField } from './types/discord.ts';
import type { RuntimeInformation, ValidErrors } from './types/application.ts';

class Application {
  static readonly package: typeof packageJson = packageJson;
  static readonly runtimeInformation = Object.freeze({ commit: this.getGitCommit(), dirty: this.getGitDirty() });
  readonly database: DatabaseManager;
  readonly discord: DiscordManager;
  readonly scripts: ScriptManager;
  readonly spark: SparkManager;
  static readonly cache: CacheHandler = new CacheHandler();
  constructor(readonly config: Config) {
    this.database = new DatabaseManager(this);
    this.discord = new DiscordManager(this);
    this.scripts = new ScriptManager(this);
    this.spark = new SparkManager(this);
  }

  static async request<T>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    const headers = new AxiosHeaders(config.headers as AxiosHeaders | undefined);
    if (!headers.has('User-Agent')) headers.set('User-Agent', this.getUserAgent());
    return await axios.request<T>({ ...config, url, method: config.method ?? 'GET', headers });
  }

  async logError(error: ValidErrors, extraData: EmbedHelperField[] = []) {
    console.error(error);
    if (!this.discord.isClientOnline()) return;

    try {
      const channel = await this.discord.getChannel('errorLog');
      if (channel === null || !channel.isSendable()) {
        throw new PolyHelperError('Error logs channel could not be found');
      }
      const hasPermission = await canSendMessages(channel);
      if (!hasPermission) return;
      await channel.send({
        content: getErrorTypeName(error) === 'Generic Error' ? '<@1276524855445164098>' : '',
        embeds: [getFullErrorEmbed(error, extraData)]
      });
    } catch (error) {
      console.error(error);
    }
  }

  private static getGitCommit(): RuntimeInformation['commit'] {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error(error);
      return 'UNKNOWN';
    }
  }

  private static getGitDirty(): RuntimeInformation['dirty'] {
    try {
      return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  static get startTime(): RuntimeInformation['startTime'] {
    return Math.floor(Date.now() / 1000) - Math.floor(process.uptime());
  }

  static getRuntimeInformation(): RuntimeInformation {
    return { commit: this.runtimeInformation.commit, dirty: this.runtimeInformation.dirty, startTime: this.startTime };
  }

  static getUserAgent() {
    return `${this.package.name}/git:${this.runtimeInformation.commit} (github:Polyfrost/PolyHelper)`;
  }
}

export default Application;
