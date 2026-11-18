import BasicInteractionHandler from '../private/BasicInteractionHandler.ts';
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  REST,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes
} from 'discord.js';
import { InteractionResponse } from '../../types/discord.ts';
import { readdir } from 'node:fs/promises';
import { toCamelCase, upperFirst } from '../../utils/stringUtils.ts';
import { toError } from '../../utils/miscUtils.ts';
import type DiscordCommand from '../private/interactions/commands/DiscordCommand.ts';
import type PolyHelperError from '../../private/error.ts';

class CommandHandler extends BasicInteractionHandler<ChatInputCommandInteraction, DiscordCommand> {
  override getRawIdFromInteraction(interaction: ChatInputCommandInteraction) {
    return interaction.commandName;
  }

  override async handleResponse(interaction: ChatInputCommandInteraction, element: DiscordCommand) {
    if (element.metadata.response === InteractionResponse.None) return;
    await interaction.deferReply({ flags: element.shouldEphemeral(interaction) ? MessageFlags.Ephemeral : undefined });
  }

  override async beforeExectue(interaction: ChatInputCommandInteraction, element: DiscordCommand): Promise<boolean> {
    const subcommand = this.checkForSubcommand(interaction);
    if (subcommand) {
      const funcName = `execute${upperFirst(toCamelCase(subcommand))}`;
      const stupidCommand = element as any;
      if (typeof stupidCommand[funcName] === 'function') {
        await stupidCommand[funcName](interaction);
        return true;
      }
    }
    return false;
  }

  private checkForSubcommand(interaction: ChatInputCommandInteraction): string | null {
    try {
      return interaction.options.getSubcommand(true);
    } catch {
      return null;
    }
  }

  async onAutocomplete(interaction: AutocompleteInteraction) {
    const element = this.elements.get(interaction.commandName);
    if (!element) return;
    try {
      const hasPermission = await this.checkPermission(interaction, element.metadata.permission).catch(
        (error: PolyHelperError) => error.message
      );
      if (hasPermission) return await interaction.respond([{ name: hasPermission, value: 'missingPermission' }]);

      const options = await element.autocomplete(interaction);
      if (options.length === 0) options.push({ name: 'No choices found', value: 'UNKNOWN' });
      const focusedOption = interaction.options.getFocused(true);
      await interaction.respond(
        options
          .filter((choice) => choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
          .slice(0, 25)
          .map((choice) => ({ name: choice.name, value: choice.value ?? choice.name }))
      );
    } catch (error) {
      await this.discord.handleError(toError(error), interaction, [], element.metadata);
    }
  }

  override async loadElements() {
    this.elements.clear();
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    const commandFiles = await readdir('./src/discord/commands/', { recursive: true, encoding: 'utf-8' }).then(
      (files) => files.filter((file) => file.endsWith('.ts'))
    );

    for (const file of commandFiles) {
      const command: DiscordCommand = new (await import(`../commands/${file}`)).default(this.discord);
      if (command.metadata.name) {
        commands.push(command.metadata.toJSON());
        this.elements.set(command.metadata.name, command);
      }
    }

    const contextMenus = await this.discord.contextMenuHandler.loadElements();

    const rest = new REST({ version: '10' }).setToken(this.discord.application.config.discord.token);
    const clientId = Buffer.from(
      this.discord.application.config.discord.token.split('.')?.[0] || 'UNKNOWN',
      'base64'
    ).toString('ascii');

    await rest
      .put(Routes.applicationGuildCommands(clientId, this.discord.application.config.discord.serverId), {
        body: [...commands, ...contextMenus]
      })
      .then(() =>
        console.discord(
          `Successfully reloaded ${[...commands, ...contextMenus].length} application guilds command(s) into ${this.discord.application.config.discord.serverId}.`
        )
      );
  }
}

export default CommandHandler;
