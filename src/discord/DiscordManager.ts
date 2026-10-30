import ButtonHandler from './handlers/ButtonHandler.ts';
import CommandHandler from './handlers/CommandHandler.ts';
import ContextMenuHandler from './handlers/ContextMenuHandler.ts';
import EventHandler from './handlers/EventHandler.ts';
import MessageHandler from './handlers/MessageHandler.ts';
import ModalHandler from './handlers/ModalHandler.ts';
import PolyHelperError from '../private/error.ts';
import StringSelectMenuHandler from './handlers/StringSelectMenuHandler.ts';
import {
  BaseInteraction,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type Guild,
  Message,
  MessageFlags,
  type SendableChannels,
  type TextChannel
} from 'discord.js';
import { convertInteractionTypeToHuman } from '../utils/discordUtils.ts';
import { getCleanErrorEmbed, toError } from '../utils/miscUtils.ts';
import { writeFile } from 'node:fs/promises';
import type Application from '../Application.ts';
import type BasicInteractionMetadata from './private/interactions/basic/BasicInteractionMetadata.ts';
import type DiscordCommandMetadata from './private/interactions/commands/DiscordCommandMetadata.ts';
import type { Config } from '../types/config.ts';
import type {
  DiscordManagerWithClient,
  DiscordManagerWithGuild,
  EmbedHelperField,
  InteractionTypes
} from '../types/discord.ts';
import type { ValidErrors } from '../types/application.ts';

class DiscordManager {
  readonly buttonHandler: ButtonHandler;
  readonly commandHandler: CommandHandler;
  readonly contextMenuHandler: ContextMenuHandler;
  readonly eventHandler: EventHandler;
  readonly messageHandler: MessageHandler;
  readonly modalHandler: ModalHandler;
  readonly stringSelectMenuHandler: StringSelectMenuHandler;
  client?: Client;
  guild?: Guild;
  constructor(readonly application: Application) {
    this.buttonHandler = new ButtonHandler(this);
    this.commandHandler = new CommandHandler(this);
    this.contextMenuHandler = new ContextMenuHandler(this);
    this.eventHandler = new EventHandler(this);
    this.messageHandler = new MessageHandler(this);
    this.modalHandler = new ModalHandler(this);
    this.stringSelectMenuHandler = new StringSelectMenuHandler(this);
  }

  async connect() {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
      ]
    });
    client.discordManager = this;
    this.client = client;
    await this.commandHandler.loadElements();
    await this.buttonHandler.loadElements();
    await this.modalHandler.loadElements();
    await this.stringSelectMenuHandler.loadElements();
    this.client.on(Events.ClientReady, (client) => this.eventHandler.onReady(client));
    this.client.on(Events.MessageCreate, (message) =>
      this.messageHandler.onMessage(message).catch((e) => this.handleError(toError(e)))
    );
    this.client.on(Events.InteractionCreate, (interaction) =>
      this.onInteraction(interaction).catch((e) => this.handleError(toError(e)))
    );
    this.client.on(Events.GuildAuditLogEntryCreate, (entry) => this.eventHandler.onGuildAuditLogEntryCreate(entry));
    this.client.login(this.application.config.discord.token).catch((e) => this.handleError(toError(e)));
  }

  async loadGuild(): Promise<DiscordManagerWithGuild> {
    if (!this.isClientOnline()) {
      throw new PolyHelperError("The discord bot doesn't seam to be online? Please restart the application");
    }
    this.guild = await this.client.guilds.fetch(this.application.config.discord.serverId);
    console.discord(`Guild ready, successfully fetched ${this.guild.name} (${this.guild.id})`);
    if (!this.isGuildReady()) throw new PolyHelperError('Something went wrong loading the guild');
    return this;
  }

  isGuildReady(): this is DiscordManagerWithGuild {
    if (!this.isClientOnline()) return false;
    return this.guild?.id !== undefined;
  }

  isClientOnline(): this is DiscordManagerWithClient {
    return this.client?.isReady() === true;
  }

  hasClient(): this is DiscordManager & { client: Client } {
    return this.client !== undefined;
  }

  private async onInteraction(interaction: BaseInteraction) {
    if (interaction.isChatInputCommand()) await this.commandHandler.onInteraction(interaction);
    if (interaction.isAutocomplete()) await this.commandHandler.onAutocomplete(interaction);
    if (interaction.isButton()) await this.buttonHandler.onInteraction(interaction);
    if (interaction.isModalSubmit()) await this.modalHandler.onInteraction(interaction);
    if (interaction.isStringSelectMenu()) await this.stringSelectMenuHandler.onInteraction(interaction);
    if (interaction.isContextMenuCommand()) await this.contextMenuHandler.onInteraction(interaction);
  }

  private getErrorContext(context: InteractionTypes | Message | null = null): EmbedHelperField[] {
    const extraData: EmbedHelperField[] = [];
    if (!context) return extraData;
    if (context instanceof BaseInteraction) {
      extraData.push({ name: 'Source', value: 'Discord Interaction' });
      extraData.push({ name: 'User', value: context.user, format: 'Discord User' });
      extraData.push({ name: 'Interaction Type', value: convertInteractionTypeToHuman(context.type) });
      if (context.isCommand()) {
        extraData.push({ name: 'Command', value: context.commandName, format: 'Small Block' });
      }
      if (context.isMessageComponent()) {
        extraData.push({ name: 'Id', value: context.customId, format: 'Small Block' });
        extraData.push({ name: 'Message', value: context.message.url });
      }
    }
    if (context instanceof Message) {
      extraData.push({ name: 'Source', value: 'Discord Message' });
      extraData.push({ name: 'Author', value: context.author, format: 'Discord User' });
      extraData.push({ name: 'URL', value: context.url });
    }
    if (context.channel) extraData.push({ name: 'Channel', value: context.channel, format: 'Discord Channel' });
    if (context.guild) extraData.push({ name: 'Guild', value: context.guild, format: 'Discord Guild' });
    return extraData;
  }

  async handleError(
    error: ValidErrors,
    context: InteractionTypes | Message | null = null,
    extraErrorData: EmbedHelperField[] = [],
    metadata: BasicInteractionMetadata | DiscordCommandMetadata | null = null
  ) {
    extraErrorData.push(...this.getErrorContext(context));
    await this.application.logError(error, extraErrorData);
    if (!context || !(context instanceof BaseInteraction)) return;

    if (context.isAutocomplete()) {
      try {
        await context.respond([]);
      } catch (e: unknown) {
        this.application.logError(toError(e));
      }
      return;
    }

    try {
      const embed = getCleanErrorEmbed(error, metadata);
      if (context.replied || context.deferred) {
        await context.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        await context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (e: unknown) {
      this.application.logError(toError(e));
    }
  }

  async getChannel(type: keyof Config['discord']['channels']): Promise<SendableChannels> {
    if (!this.isGuildReady()) {
      await this.loadGuild();
      throw new PolyHelperError("The discord server isn't ready. Please try again later");
    }
    const config = this.application.config.discord.channels[type];
    if (config === null) {
      if (!this.isGuildReady()) {
        throw new PolyHelperError("The discord server isn't ready. Please try again later");
      }

      const channel = await this.guild.channels.create({ name: type });
      this.application.config.discord.channels[type] = channel.id;
      await writeFile('config.json', JSON.stringify(this.application.config, null, 2), 'utf-8');
      return channel;
    }

    const channel = await this.client.channels.fetch(config);
    if (channel === null || !channel.isSendable()) throw new PolyHelperError(`Channel "${type}" not found!`);
    return channel;
  }

  async getSupportChannel(): Promise<TextChannel> {
    const channel = await this.getChannel('support');
    if (channel.type !== ChannelType.GuildText) throw new PolyHelperError('Could not find the support channel?');
    return channel;
  }
}

export default DiscordManager;
