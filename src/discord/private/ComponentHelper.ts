import PolyHelperError from '../../private/error.ts';
import config from '../../../config.json' with { type: 'json' };
import {
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
  TextInputStyle
} from 'discord.js';
import { ConfigDiscordEmbedsColors } from '../../types/config.ts';
import { hexToRgb } from '../../utils/miscUtils.ts';
import type Panel from '../../database/private/Panel.ts';
import type SupportTeam from '../../database/private/SupportTeam.ts';
import type { DatabaseCloseRequest, DatabasePanel, DatabaseSupportTeam } from '../../types/database.ts';

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
      new StringSelectMenuBuilder()
        .setCustomId('supportTeamId')
        .setOptions(
          supportTeams.map((team) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(team.name)
              .setValue(team.id)
              .setDefault(panel?.supportTeamId === team.id)
          )
        )
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
          "- `{mention}` - Ticket Opener's mention",
          "- `{username}` - Ticket Opener's username",
          "- `{id}` - Ticket Opener's id"
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
