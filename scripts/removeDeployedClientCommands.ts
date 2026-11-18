import ConfigManager from '../src/ConfigManager.ts';
import { REST, Routes } from 'discord.js';
import { mkdir } from 'node:fs/promises';
import '../src/private/logger.ts';

await mkdir('./data/', { recursive: true });
const configManager = new ConfigManager();
const config = await configManager.init();

const rest = new REST({ version: '10' }).setToken(config.discord.token);
const clientId = Buffer.from(config.discord.token.split('.')?.[0] || 'UNKNOWN', 'base64').toString('ascii');

await rest
  .put(Routes.applicationCommands(clientId), { body: [] })
  .then(() => console.other('Successfully removed all application command(s).'));
