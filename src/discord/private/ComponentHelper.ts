import Application from '../../Application.ts';
import EmbedHelper from './EmbedHelper.ts';
import PolyHelperError from '../../private/error.ts';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  CheckboxBuilder,
  ContainerBuilder,
  type HexColorString,
  LabelBuilder,
  ModalBuilder,
  type RGBTuple,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} from 'discord.js';
import { ConfigDiscordEmbedsColors } from '../../types/config.ts';
import { hexToRgb } from '../../utils/miscUtils.ts';
import { readFileSync } from 'node:fs';
import type Panel from '../../database/private/Panel.ts';
import type SupportTeam from '../../database/private/SupportTeam.ts';
import type Ticket from '../../database/private/Ticket.ts';
import type { DatabaseCloseRequest, DatabasePanel, DatabaseSupportTeam } from '../../types/database.ts';
import type { MinimalRepository } from '../../types/github.ts';
import type { TicketSearch } from '../../types/misc.ts';

const config = JSON.parse(readFileSync('config.json', 'utf-8'));

export class PatchedContainerBuilder extends ContainerBuilder {
  constructor() {
    super();
    this.setAccentColor('Pink');
  }

  override setAccentColor(color?: ConfigDiscordEmbedsColors | HexColorString | RGBTuple | number): this {
    if (ConfigDiscordEmbedsColors.safeParse(color).success) {
      return super.setAccentColor(
        hexToRgb(config.discord.embeds.colors[color as ConfigDiscordEmbedsColors] as HexColorString)
      );
    }
    if (typeof color === 'string') {
      return super.setAccentColor(hexToRgb(color as HexColorString));
    }
    return super.setAccentColor(color);
  }
}

export function ViewInformationButton(ownerId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('View Information')
    .setCustomId(`viewInformation:${ownerId}`);
}

export function ViewCreditsButton(ownerId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('View Credits')
    .setCustomId(`viewCredits:${ownerId}`);
}

export function ViewSourceCodeButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel('View Source Code')
    .setURL('https://github.com/Polyfrost/PolyHelper');
}

export function OpenTicketButton({
  id,
  buttonLabel,
  buttonStyle,
  buttonEmoji,
  enabled
}: Panel | DatabasePanel): ButtonBuilder {
  const button = new ButtonBuilder()
    .setStyle(buttonStyle)
    .setLabel(buttonLabel)
    .setCustomId(`openTicket:${id}`)
    .setDisabled(!Boolean(enabled));
  if (buttonEmoji) button.setEmoji(buttonEmoji);
  return button;
}

export function BasicPanelModal(panel?: Panel | DatabasePanel) {
  return new ModalBuilder().addLabelComponents(
    new LabelBuilder().setLabel('Panel Name').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(panel?.name ?? '')
    ),
    new LabelBuilder().setLabel('Title').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(panel?.title ?? '')
    ),
    new LabelBuilder().setLabel('Description').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(panel?.description ?? '')
    ),
    new LabelBuilder().setLabel('Max Open Tickets Open Simultaneously').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('maxOpenTickets')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(panel?.maxOpenTickets ?? 1))
    ),

    new LabelBuilder()
      .setLabel('Enabled')
      .setCheckboxComponent(new CheckboxBuilder().setCustomId('enabled').setDefault(Boolean(panel?.enabled ?? 1)))
  );
}

export function SupportTeamStringSelectMenu(
  supportTeams: DatabaseSupportTeam[] | SupportTeam[],
  supportTeam?: DatabaseSupportTeam['id']
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder().setOptions(
    supportTeams.map((team) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(team.name)
        .setValue(team.id)
        .setDefault(supportTeam === team.id)
    )
  );
}

export function SupportTeamPanelModal(
  supportTeams: DatabaseSupportTeam[] | SupportTeam[],
  panel?: Panel | DatabasePanel
) {
  if (supportTeams.length === 0) {
    throw new PolyHelperError(
      "There aren't any support teams. Please create one before trying to assign a support team"
    );
  }
  return new ModalBuilder().addLabelComponents(
    new LabelBuilder().setLabel('Support Team').setStringSelectMenuComponent(
      SupportTeamStringSelectMenu(supportTeams, panel?.supportTeamId ?? undefined)
        .setCustomId('supportTeamId')
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new LabelBuilder()
      .setLabel('Ping Support Team On Open')
      .setCheckboxComponent(
        new CheckboxBuilder()
          .setCustomId('pingSupportTeamOnOpen')
          .setDefault(Boolean(panel?.pingSupportTeamOnOpen ?? 1))
      )
  );
}

export function ButtonOptionsPanelModal(panel?: Panel | DatabasePanel) {
  return new ModalBuilder().addLabelComponents(
    new LabelBuilder().setLabel('Label').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('buttonLabel')
        .setStyle(TextInputStyle.Short)
        .setValue(panel?.buttonLabel ?? '')
        .setRequired(true)
    ),
    new LabelBuilder().setLabel('Emoji (emoji id)').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('buttonEmoji')
        .setStyle(TextInputStyle.Short)
        .setValue(panel?.buttonEmoji ?? '')
        .setRequired(false)
    ),
    new LabelBuilder().setLabel('Style').setRadioGroupComponent(
      new RadioGroupBuilder().setCustomId('buttonStyle').setOptions(
        new RadioGroupOptionBuilder()
          .setLabel('Primary')
          .setValue('1')
          .setDefault(panel === undefined ? false : panel.buttonStyle === 1),
        new RadioGroupOptionBuilder()
          .setLabel('Secondary')
          .setValue('2')
          .setDefault(panel === undefined ? true : panel.buttonStyle === 2),
        new RadioGroupOptionBuilder()
          .setLabel('Success')
          .setValue('3')
          .setDefault(panel === undefined ? false : panel.buttonStyle === 3),
        new RadioGroupOptionBuilder()
          .setLabel('Danger')
          .setValue('4')
          .setDefault(panel === undefined ? false : panel.buttonStyle === 4)
      )
    )
  );
}

export function TicketOpenOptionsPanelModal(panel?: Panel | DatabasePanel) {
  return new ModalBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Variables',
          '',
          "- `{panelName}` - Ticket Panel's name",
          "- `{mention}` - Ticket Owner's mention",
          "- `{username}` - Ticket Owner's username",
          "- `{id}` - Ticket Owner's id"
        ].join('\n')
      )
    )
    .addLabelComponents(
      new LabelBuilder().setLabel('Starting Message Content').setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('openingMessageContent')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(panel?.openingMessageContent ?? '{mention}')
      ),
      new LabelBuilder().setLabel('Starting Embed Title').setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('openingMessageTitle')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(panel?.openingMessageTitle ?? '{panelName}')
      ),
      new LabelBuilder().setLabel('Starting Embed Description').setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('openingMessage')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(panel?.openingMessage ?? '{panelName}')
      ),
      new LabelBuilder()
        .setLabel('Ping Support Team On Open')
        .setCheckboxComponent(
          new CheckboxBuilder()
            .setCustomId('pingSupportTeamOnOpen')
            .setDefault(Boolean(panel?.pingSupportTeamOnOpen ?? 1))
        )
    );
}

export function CloseRequestButtons(id: DatabaseCloseRequest['id'], disabled: boolean = false): ButtonBuilder[] {
  return [
    new ButtonBuilder()
      .setLabel('Accept & Close')
      .setCustomId(`closeRequestAccept:${id}`)
      .setEmoji('☑️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || id === 'UNKNOWN'),
    new ButtonBuilder()
      .setLabel('Deny & Keep Open')
      .setCustomId(`closeRequestDeny:${id}`)
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || id === 'UNKNOWN')
  ];
}

export function SupportTeamModal(supportTeam?: SupportTeam | DatabaseSupportTeam): ModalBuilder {
  return new ModalBuilder().addLabelComponents(
    new LabelBuilder().setLabel('name').setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(supportTeam?.name ?? '')
    ),
    new LabelBuilder().setLabel('support role').setRoleSelectMenuComponent(
      new RoleSelectMenuBuilder()
        .setCustomId('supportRole')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
        .setDefaultRoles(...(supportTeam?.supportRole ? [supportTeam.supportRole] : []))
    ),
    new LabelBuilder().setLabel('ticket ping role').setRoleSelectMenuComponent(
      new RoleSelectMenuBuilder()
        .setCustomId('ticketPingRole')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
        .setDefaultRoles(...(supportTeam?.ticketPingRole ? [supportTeam.ticketPingRole] : []))
    )
  );
}

export function PanelStringSelectMenu(
  panels: DatabasePanel[] | Panel[],
  currentPanel?: DatabasePanel['id']
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder().setOptions(
    panels.map((panel) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(panel.name)
        .setValue(panel.id)
        .setDefault(currentPanel === panel.id)
    )
  );
}

export function GithubReposStringSelectMenu(
  repos: MinimalRepository[],
  current?: MinimalRepository['name']
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder().setOptions(
    repos
      .filter((repo) => !repo.archived)
      .filter((repo) => !repo.fork)
      .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
      .slice(0, 25)
      .map((repo) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(repo.name)
          .setValue(repo.name)
          .setDefault(repo.name === current)
      )
  );
}

export function TicketSearchFilterModal(
  search: TicketSearch,
  panels: DatabasePanel[] | Panel[],
  repos: MinimalRepository[]
): ModalBuilder {
  return new ModalBuilder().addLabelComponents(
    new LabelBuilder()
      .setLabel('Panel')
      .setStringSelectMenuComponent(
        PanelStringSelectMenu(panels, search.panelId)
          .setCustomId('panelId')
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(false)
      ),
    new LabelBuilder().setLabel('Owner').setUserSelectMenuComponent(
      new UserSelectMenuBuilder()
        .setCustomId('owner')
        .setDefaultUsers(search.owner !== undefined ? [search.owner] : [])
        .setMaxValues(1)
        .setMinValues(1)
        .setRequired(false)
    ),
    new LabelBuilder()
      .setLabel('Tagged Project')
      .setStringSelectMenuComponent(
        GithubReposStringSelectMenu(repos, search.taggedProject)
          .setCustomId('taggedProject')
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(false)
      ),
    new LabelBuilder().setLabel('Pin State').setRadioGroupComponent(
      new RadioGroupBuilder().setCustomId('pinned').setOptions(
        new RadioGroupOptionBuilder()
          .setLabel('Any')
          .setValue('any')
          .setDefault(search.pinned === undefined),
        new RadioGroupOptionBuilder()
          .setLabel('Pinned')
          .setValue('true')
          .setDefault(search.pinned === true),
        new RadioGroupOptionBuilder()
          .setLabel('Unpinned')
          .setValue('false')
          .setDefault(search.pinned === false)
      )
    ),
    new LabelBuilder().setLabel('Ticket State').setRadioGroupComponent(
      new RadioGroupBuilder().setCustomId('closed').setOptions(
        new RadioGroupOptionBuilder()
          .setLabel('Any')
          .setValue('any')
          .setDefault(search.closed === undefined),
        new RadioGroupOptionBuilder()
          .setLabel('Open')
          .setValue('false')
          .setDefault(search.closed === false),
        new RadioGroupOptionBuilder()
          .setLabel('Closed')
          .setValue('true')
          .setDefault(search.closed === true)
      )
    )
  );
}

export function TicketSearchResults(tickets: Ticket[], search: TicketSearch): BaseMessageOptions {
  const embed = new EmbedHelper()
    .setTitle('Ticket Search')
    .setDescription(`Found **${tickets.length} ticket(s)** with the following filter(s)`);
  const searchId = crypto.randomUUID();
  Application.cache.set<TicketSearch>(`ticket:search:${searchId}`, search);

  if (search.pinned !== undefined) {
    embed.addFields({ name: 'Pin State', value: search.pinned ? 'Pinned' : 'Unpinned' });
  }
  if (search.closed !== undefined) embed.addFields({ name: 'State', value: search.closed ? 'Closed' : 'Open' });
  if (search.inactivitySilenced !== undefined) {
    embed.addFields({ name: 'Inactivity State', value: search.inactivitySilenced ? 'Silenced' : 'Unsilenced' });
  }
  if (search.taggedProject) embed.addFields({ name: 'Tagged Project', value: search.taggedProject, format: 'Block' });
  if (search.panelId) embed.addFields({ name: 'Panel Id', value: search.panelId, format: 'Block' });
  if (search.owner) embed.addFields({ name: 'Owner', value: `<@${search.owner}> (${search.owner})` });

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticketsSearch')
          .setPlaceholder(tickets.length === 0 ? 'No tickets found' : 'Select a ticket to view more')
          .setDisabled(tickets.length === 0)
          .setOptions(
            tickets.length === 0
              ? [new StringSelectMenuOptionBuilder().setLabel('No tickets found').setValue('nothing')]
              : tickets.map((ticket) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(`${ticket.name} - ${new Date(ticket.lastUpdated).toISOString().split('T')[0]}`)
                    .setValue(ticket.id)
                )
          )
      ),
      new ActionRowBuilder<ButtonBuilder>().setComponents(
        new ButtonBuilder()
          .setCustomId(`ticketSearchFilter:${searchId}`)
          .setLabel('Edit Filters')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('joinTickets')
          .setLabel('Join Found Ticket Threads')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(tickets.length === 0)
      )
    ]
  };
}
