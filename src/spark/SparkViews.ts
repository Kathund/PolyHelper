import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  FileBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder
} from 'discord.js';
import { PatchedContainerBuilder } from '../discord/private/ComponentHelper.ts';
import { getSparkURL } from '../utils/sparkUtils.ts';
import type { ConfigDiscordEmbedsColors } from '../types/config.ts';
import type { SparkFinding, SparkJob, SparkReport, SparkResult } from '../types/spark.ts';

const maxTextChars = 3900;

const maxComponents = 40;

const maxFindings = 5;

const aiWarning = '⚠️ AI-generated. Check it before acting on it.';

function clamp(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function isLink(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/\S+$/.test(url) && url.length <= 512;
}

function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
}

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function divider(large = false): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
}

function gap(): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);
}

function header(content: string, iconUrl: string | null): SectionBuilder | TextDisplayBuilder {
  if (!isLink(iconUrl)) return text(content);
  return new SectionBuilder()
    .addTextDisplayComponents(text(content))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl));
}

function addHeader(container: PatchedContainerBuilder, content: string, iconUrl: string | null) {
  const block = header(content, iconUrl);
  if (block instanceof SectionBuilder) container.addSectionComponents(block);
  else container.addTextDisplayComponents(block);
}

function bullets(items: string[], max = 4, length = 220): string {
  return items
    .slice(0, max)
    .map((item) => `- ${clamp(item, length)}`)
    .join('\n');
}

function title(job: SparkJob): string {
  return job.mode === 'compare' ? 'Spark Comparison' : 'Spark Analysis';
}

function profileLine(result: SparkResult | null, job: SparkJob): string {
  const parts: string[] = [job.profile.sparkId, job.mode];
  const prepass = result?.prepass;
  if (prepass?.mcVersion) parts.push(`MC ${prepass.mcVersion}`);
  if (prepass?.loader) parts.push(prepass.loader);
  if (prepass) parts.push(`${prepass.problem.mods.length} mods`);
  return `-# ${parts.join(' · ')}`;
}

function requestLine(job: SparkJob): string {
  const baseline = job.baseline ? ` · vs [baseline](${getSparkURL(job.baseline.sparkId)})` : '';
  return `-# <@${job.requester}> in <#${job.channelId}>${baseline}`;
}

function durationText(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function profileButtons(job: SparkJob): ButtonBuilder[] {
  const buttons = [linkButton('Spark Profile', getSparkURL(job.profile.sparkId))];
  if (job.baseline) buttons.push(linkButton('Baseline Profile', getSparkURL(job.baseline.sparkId)));
  return buttons;
}

function summaryText(report: SparkReport, withChanges: boolean, compact = false): string {
  const count = compact ? 3 : 4;
  const length = compact ? 140 : 220;
  const lines = [`**Verdict**\n${clamp(report.verdict, compact ? 300 : 450)}`];
  if (report.evidence.length > 0) lines.push(`**Evidence**\n${bullets(report.evidence, count, length)}`);
  if (report.tellUser.length > 0) lines.push(`**Tell the user**\n${bullets(report.tellUser, count, length)}`);
  if (withChanges && report.changes?.length) {
    lines.push(
      `**Changes**\n${bullets(
        report.changes.map((change) => `\`${change.mod}\` ${change.change}: ${change.detail}`),
        compact ? 3 : 5,
        compact ? 120 : 160
      )}`
    );
  }
  if (withChanges && report.confounded) lines.push(`-# ⚠️ ${clamp(report.confounded, 200)}`);
  return lines.join('\n');
}

function partialReport(result: SparkResult): SparkReport {
  return {
    verdict: 'The analysis ran out of budget before it finished. The notes it had so far are below.',
    evidence: [],
    tellUser: [],
    primaryMod: null,
    findings: [],
    analysis: result.text ?? 'No notes were written before the budget ran out.',
    handoff: null,
    changes: null,
    confounded: null
  };
}

function findingText(finding: SparkFinding): string {
  const icon = finding.status === 'confirmed' ? '✅' : '❓';
  const mod = finding.mod ? ` · \`${finding.mod}\`` : '';
  return `${icon} **${clamp(finding.title, 120)}**\n-# ${finding.status}${mod} · ${clamp(finding.detail, 200)}`;
}

function addFindings(container: PatchedContainerBuilder, findings: SparkFinding[]) {
  container.addTextDisplayComponents(text('### Findings'));
  let pending: string[] = [];
  const flush = () => {
    if (pending.length > 0) container.addTextDisplayComponents(text(pending.join('\n')));
    pending = [];
  };
  for (const finding of findings) {
    if (!isLink(finding.sourceUrl)) {
      pending.push(findingText(finding));
      continue;
    }
    flush();
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(findingText(finding)))
        .setButtonAccessory(linkButton('Source', finding.sourceUrl))
    );
  }
  flush();
}

function buildAnalysisFile(job: SparkJob, report: SparkReport): string {
  const sections = [
    `# ${title(job)}: ${job.profile.sparkId}`,
    getSparkURL(job.profile.sparkId),
    job.baseline ? `Baseline: ${getSparkURL(job.baseline.sparkId)}` : null,
    `## Verdict\n\n${report.verdict}`,
    report.evidence.length ? `## Evidence\n\n${report.evidence.map((item) => `- ${item}`).join('\n')}` : null,
    report.tellUser.length ? `## Tell the user\n\n${report.tellUser.map((item) => `- ${item}`).join('\n')}` : null,
    report.findings.length
      ? `## Findings\n\n${report.findings
          .map(
            (finding) =>
              `- **${finding.title}** (${finding.status}): ${finding.detail}${finding.sourceUrl ? ` ${finding.sourceUrl}` : ''}`
          )
          .join('\n')}`
      : null,
    `## Analysis\n\n${report.analysis}`,
    report.handoff
      ? `## Dev handoff\n\n${[
          `Mod: ${report.handoff.mod} ${report.handoff.version ?? ''}`,
          `Repo: ${report.handoff.repo ?? 'unknown'} @ ${report.handoff.ref ?? 'default branch'}`,
          `Where: ${report.handoff.file ?? '?'} ${report.handoff.symbol ?? ''} ${report.handoff.fileUrl ?? ''}`,
          `Problem: ${report.handoff.problem}`,
          `Suspected cause: ${report.handoff.suspectedCause}`,
          '',
          '```text',
          report.handoff.task,
          '```'
        ].join('\n')}`
      : null,
    `---\n${aiWarning}`
  ];
  return sections.filter((section): section is string => section !== null).join('\n\n');
}

function countComponents(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum: number, entry) => sum + countComponents(entry), 0);
  if (typeof value !== 'object' || value === null) return 0;
  const record = value as Record<string, unknown>;
  const self = typeof record.type === 'number' ? 1 : 0;
  return self + countComponents(record.components) + countComponents(record.accessory);
}

function countText(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum: number, entry) => sum + countText(entry), 0);
  if (typeof value !== 'object' || value === null) return 0;
  const record = value as Record<string, unknown>;
  const own = record.type === 10 && typeof record.content === 'string' ? record.content.length : 0;
  return own + countText(record.components) + countText(record.accessory);
}

function fits(containers: PatchedContainerBuilder[]): boolean {
  const json = containers.map((container) => container.toJSON());
  return countComponents(json) <= maxComponents && countText(json) <= maxTextChars;
}

function view(components: PatchedContainerBuilder[], files: AttachmentBuilder[] = []): SparkView {
  return { components, files, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

function handoffContainer(
  report: SparkReport,
  iconUrl: string | null,
  compact: boolean
): PatchedContainerBuilder | null {
  const handoff = report.handoff;
  if (!handoff) return null;
  const container = new PatchedContainerBuilder().setAccentColor('Blue');
  const where = handoff.repo ? `${handoff.repo} @ ${handoff.ref ?? 'default branch'}` : 'repository unknown';
  addHeader(container, `### Dev Handoff\n**${handoff.mod}** ${handoff.version ?? ''}\n-# ${where}`, iconUrl);
  container.addSeparatorComponents(divider());
  const details = [
    handoff.symbol || handoff.file ? `**Where** \`${clamp(handoff.symbol ?? handoff.file ?? '', 150)}\`` : null,
    `**Problem** ${clamp(handoff.problem, compact ? 200 : 300)}`,
    `**Suspected cause** ${clamp(handoff.suspectedCause, compact ? 200 : 300)}`
  ].filter(Boolean);
  container.addTextDisplayComponents(text(details.join('\n')));
  container.addTextDisplayComponents(
    text(`\`\`\`text\n${clamp(handoff.task, compact ? 500 : 900).replaceAll('```', "'''")}\n\`\`\``)
  );
  const buttons = [
    isLink(handoff.fileUrl) ? linkButton('Open File', handoff.fileUrl) : null,
    isLink(handoff.upstreamTracker) ? linkButton('Issue Tracker', handoff.upstreamTracker) : null
  ].filter((button): button is ButtonBuilder => button !== null);
  if (buttons.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
  }
  return container;
}

function statusContainer(
  job: SparkJob,
  color: ConfigDiscordEmbedsColors,
  status: string,
  channelUrl: string | null,
  includeRequest: boolean
): PatchedContainerBuilder {
  const container = new PatchedContainerBuilder().setAccentColor(color);
  const request = includeRequest ? `\n${requestLine(job)}` : '';
  container.addTextDisplayComponents(
    text(`## ${title(job)}\n-# ${status}${request}\n-# sparkId: ${job.profile.sparkId}`)
  );
  const buttons = profileButtons(job);
  if (channelUrl) buttons.unshift(linkButton('Full Analysis', channelUrl));
  container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
  return container;
}

export interface SparkView {
  components: PatchedContainerBuilder[];
  files: AttachmentBuilder[];
  flags: MessageFlags.IsComponentsV2;
  allowedMentions: { parse: [] };
}

export function getChannelView(
  job: SparkJob,
  result: SparkResult,
  icons: { primary: string | null; handoff: string | null }
): SparkView {
  const report = result.report ?? partialReport(result);
  const fileName = `analysis-${job.profile.sparkId}.md`;
  const file = new AttachmentBuilder(Buffer.from(buildAnalysisFile(job, report)), { name: fileName });
  const footer = `-# ${aiWarning} · $${result.cost.toFixed(3)} · ${result.turns} turns · ${durationText(result.durationMs)}`;
  const notes = job.supportNotes ? `\n-# Notes: ${clamp(job.supportNotes, 200)}` : '';

  const shown = Math.min(report.findings.length, maxFindings);
  const attempts = [false, true].flatMap((compact) =>
    Array.from({ length: shown + 1 }, (_, index) => ({ compact, findings: shown - index }))
  );
  let last: PatchedContainerBuilder[] = [];
  for (const { compact, findings } of attempts) {
    const main = new PatchedContainerBuilder().setAccentColor(result.report ? 'Green' : 'Yellow');
    addHeader(main, `## ${title(job)}\n${profileLine(result, job)}\n${requestLine(job)}${notes}`, icons.primary);
    main.addSeparatorComponents(divider(true));
    main.addTextDisplayComponents(text(summaryText(report, true, compact)));
    if (findings > 0) {
      main.addSeparatorComponents(divider());
      addFindings(main, report.findings.slice(0, findings));
    }
    main.addSeparatorComponents(divider());
    main.addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
    main.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(profileButtons(job)));
    main.addTextDisplayComponents(text(footer));

    const handoff = handoffContainer(report, icons.handoff, compact);
    last = handoff ? [main, handoff] : [main];
    if (fits(last)) return view(last, [file]);
  }
  return view(last, [file]);
}

export function getPrivateView(
  job: SparkJob,
  result: SparkResult,
  channelUrl: string,
  iconUrl: string | null
): SparkView {
  const report = result.report ?? partialReport(result);
  const container = new PatchedContainerBuilder().setAccentColor(result.report ? 'Green' : 'Yellow');
  addHeader(container, `## ${title(job)}\n${profileLine(result, job)}`, iconUrl);
  container.addSeparatorComponents(divider(true));
  container.addTextDisplayComponents(text(summaryText(report, false)));
  container.addSeparatorComponents(gap());
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      linkButton('Full Analysis', channelUrl),
      linkButton('Spark Profile', getSparkURL(job.profile.sparkId))
    )
  );
  container.addTextDisplayComponents(text(`-# ${aiWarning}`));
  return view([container]);
}

export function getPendingView(job: SparkJob, channelUrl: string | null): SparkView {
  return view([
    statusContainer(job, 'Gray', '⏳ Analyzing · this usually takes a few minutes', channelUrl, channelUrl === null)
  ]);
}

export function getFailedView(job: SparkJob, reason: string, channelUrl: string | null): SparkView {
  return view([statusContainer(job, 'Red', `❌ ${clamp(reason, 300)}`, channelUrl, channelUrl === null)]);
}

export function getLateView(job: SparkJob, channelUrl: string): SparkView {
  return view([
    statusContainer(job, 'Gray', '⏳ Still analyzing. The result will be in the full analysis.', channelUrl, false)
  ]);
}
