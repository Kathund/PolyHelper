import BasicConfigManager from './private/BasicConfigManager.ts';
import { Config, ConfigChangeType, type MigrationMap } from './types/config.ts';

class ConfigManager extends BasicConfigManager<Config> {
  protected readonly configPath = process.env.CONFIG_PATH ?? 'config.json';
  protected readonly defaultConfigPath = 'config.example.json';
  protected readonly schema = Config;
  protected readonly versions: Record<number, MigrationMap> = {
    2: { 'logger.errorLogChannel': { key: 'discord.channels.errorLog', change: ConfigChangeType.Move } },
    3: { 'other.backupConfigs': { key: 'other.configBackups.enabled', change: ConfigChangeType.Move } },
    4: { 'discord.channels.sparkFixes': { change: ConfigChangeType.Delete } }
  };

  protected override onConfigValidated(config: Config): Config {
    process.env.GITHUB_TOKEN = config.sparkAnalysis.githubToken ?? undefined;
    return config;
  }
}

export default ConfigManager;
