import Application from '../../Application.ts';
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
  SeparatorBuilder,
  SeparatorSpacingSize,
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
import type { BaseDatabaseItem, DatabasePanel, DatabaseSupportTeam } from '../../types/database.ts';
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
    .setURL('https://github.com/kathund/PolyHelper');
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
  supportTeam?: BaseDatabaseItem['id']
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

export function CloseRequestButtons(id: BaseDatabaseItem['id'], disabled: boolean = false): ButtonBuilder[] {
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
  currentPanel?: BaseDatabaseItem['id'],
  maxOptions: number = 25
): StringSelectMenuBuilder {
  const visiblePanels = panels.slice(0, maxOptions);
  const selectedPanel = currentPanel ? panels.find((panel) => panel.id === currentPanel) : undefined;
  if (selectedPanel && !visiblePanels.some((panel) => panel.id === selectedPanel.id) && maxOptions > 0) {
    visiblePanels[maxOptions - 1] = selectedPanel;
  }

  return new StringSelectMenuBuilder().setOptions(
    visiblePanels.map((panel) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(panel.name)
        .setValue(panel.id)
        .setDefault(currentPanel === panel.id)
    )
  );
}

export function GithubReposStringSelectMenu(
  repos: MinimalRepository[],
  current?: MinimalRepository['name'],
  maxOptions: number = 25
): StringSelectMenuBuilder {
  const availableRepos = repos
    .filter((repo) => !repo.archived && !repo.fork)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
  const visibleRepos = availableRepos.slice(0, maxOptions);
  const currentRepo = current ? availableRepos.find((repo) => repo.name === current) : undefined;
  if (currentRepo && !visibleRepos.some((repo) => repo.name === currentRepo.name) && maxOptions > 0) {
    visibleRepos[maxOptions - 1] = currentRepo;
  }

  return new StringSelectMenuBuilder().setOptions(
    visibleRepos.map((repo) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(repo.name)
        .setValue(repo.name)
        .setDefault(repo.name === current)
    )
  );
}

export function createStringFilter(
  customId: string,
  placeholder: string,
  options: { label: string; value: string; selected?: boolean }[]
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(
        options.map(({ label, value, selected }) =>
          new StringSelectMenuOptionBuilder().setLabel(label).setValue(value).setDefault(selected)
        )
      )
  );
}

export function createBooleanFilter(
  customId: string,
  placeholder: string,
  value: boolean | undefined,
  labels: { true: string; false: string; unspecified: string }
): ActionRowBuilder<StringSelectMenuBuilder> {
  return createStringFilter(customId, placeholder, [
    { label: labels.unspecified, value: 'any', selected: value === undefined },
    { label: labels.true, value: 'true', selected: value === true },
    { label: labels.false, value: 'false', selected: value === false }
  ]);
}

export function getSearchContainer(
  search: TicketSearch,
  panels: DatabasePanel[] | Panel[],
  repos: MinimalRepository[],
  searchId: string
): PatchedContainerBuilder {
  return new PatchedContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## Ticket Search Filters\nChoose filters, then select **Apply Filters** to run the search.'
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Panel'))
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        PanelStringSelectMenu(panels, search.panelId, 24)
          .setCustomId(`ticketSearchFilterSelect:${searchId}:panelId`)
          .setPlaceholder('Panel')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Any Panel')
              .setValue('__any__')
              .setDefault(search.panelId === undefined)
          )
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Ticket Owner'))
    .addActionRowComponents(
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`ticketSearchFilterUser:${searchId}:owner`)
          .setPlaceholder('Owner')
          .setDefaultUsers(search.owner !== undefined ? [search.owner] : [])
          .setMaxValues(1)
          .setMinValues(0)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Tagged Project'))
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        GithubReposStringSelectMenu(repos, search.taggedProject, 24)
          .setCustomId(`ticketSearchFilterSelect:${searchId}:taggedProject`)
          .setPlaceholder('Tagged Project')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Any Project')
              .setValue('__any__')
              .setDefault(search.taggedProject === undefined)
          )
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Pin State'))
    .addActionRowComponents(
      createBooleanFilter(`ticketSearchFilterSelect:${searchId}:pinned`, 'Pin State', search.pinned, {
        true: 'Pinned',
        false: 'Unpinned',
        unspecified: 'Unspecified'
      })
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Ticket State'))
    .addActionRowComponents(
      createBooleanFilter(`ticketSearchFilterSelect:${searchId}:closed`, 'Ticket State', search.closed, {
        true: 'Closed',
        false: 'Open',
        unspecified: 'Unspecified'
      })
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Inactivity State'))
    .addActionRowComponents(
      createBooleanFilter(
        `ticketSearchFilterSelect:${searchId}:inactivitySilenced`,
        'Inactivity State',
        search.inactivitySilenced,
        { true: 'Silenced', false: 'Unsilenced', unspecified: 'Unspecified' }
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Closed By'))
    .addActionRowComponents(
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`ticketSearchFilterUser:${searchId}:closedBy`)
          .setPlaceholder('Closed By')
          .setDefaultUsers(search.closedBy !== undefined ? [search.closedBy] : [])
          .setMaxValues(1)
          .setMinValues(0)
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticketSearchApply:${searchId}`)
          .setLabel('Apply Filters')
          .setStyle(ButtonStyle.Primary)
      )
    );
}

export function TicketSearchResults(
  tickets: Ticket[],
  search: TicketSearch
): NonNullable<BaseMessageOptions['components']> {
  const searchId = crypto.randomUUID();
  Application.cache.set<TicketSearch>(`ticket:search:${searchId}`, search);

  const filters = [
    search.pinned !== undefined && `**Pin State:** ${search.pinned ? 'Pinned' : 'Unpinned'}`,
    search.closed !== undefined && `**State:** ${search.closed ? 'Closed' : 'Open'}`,
    search.inactivitySilenced !== undefined &&
      `**Inactivity State:** ${search.inactivitySilenced ? 'Silenced' : 'Unsilenced'}`,
    search.taggedProject && `**Tagged Project:** \`${search.taggedProject}\``,
    search.panelId && `**Panel Id:** \`${search.panelId}\``,
    search.owner && `**Owner:** <@${search.owner}> (${search.owner})`,
    search.closedBy && `**Closed By:** <@${search.closedBy}> (${search.closedBy})`
  ].filter((filter): filter is string => Boolean(filter));

  return [
    new PatchedContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ['## Ticket Search', `Found **${tickets.length} ticket(s)** with the following filter(s)`, ...filters].join(
          '\n'
        )
      )
    ),
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
  ];
}
