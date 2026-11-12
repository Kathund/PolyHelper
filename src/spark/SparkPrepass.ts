import PolyHelperError from '../private/error.ts';
import {
  downloadJar,
  findGate,
  findMixinsForHook,
  getPluginClasses,
  getReferencedClasses,
  readJar,
  toDotted
} from '../utils/jarUtils.ts';
import { findModSource, resolveRef, scanSourceGates } from '../utils/sourceCodeUtils.ts';
import { findModrinthVersion } from '../utils/modrinthUtils.ts';
import { getErrorMessage } from '../utils/miscUtils.ts';
import { runScript } from '../utils/sparkUtils.ts';
import type { Config } from '../types/config.ts';
import type { Gate } from '../utils/jarUtils.ts';
import type { HookRow, ProfileSummary, ScannedMod, SparkJob, SparkPrepass } from '../types/spark.ts';

const maxReportChars = 9000;

const maxDigestChars = 7000;
const maxModChars = 1200;
const maxFlaggedModChars = 2400;

const scanTimeoutMs = 45_000;

const megabyte = 1024 * 1024;

const nonModBuckets = new Set(['gl-native', 'jvm', 'unknown']);

const libraryRegex = /^(?:[a-z0-9]+_){2,}|^fabric-.+-v\d+$|^(?:java|minecraft|fabricloader|mixinextras|fabric-api)$/;

function isScannable(modId: string): boolean {
  return !nonModBuckets.has(modId) && !libraryRegex.test(modId);
}

function hookParts(hook: string): { mod: string; handler: string } {
  const [mod = '', handler = ''] = hook.split('$');
  return { mod, handler };
}

function round(value: number): string {
  return `${value.toFixed(1)}%`;
}

function pickSuspects(problem: ProfileSummary, baseline: ProfileSummary | null, limit: number): Map<string, string[]> {
  const suspects = new Map<string, string[]>();
  const add = (modId: string, reason: string) => {
    if (!isScannable(modId) || !problem.mods.includes(modId)) return;
    const reasons = suspects.get(modId) ?? [];
    reasons.push(reason);
    suspects.set(modId, reasons);
  };

  if (baseline) {
    for (const modId of problem.mods) {
      const before = baseline.mod_versions[modId];
      const after = problem.mod_versions[modId];
      if (!baseline.mods.includes(modId)) add(modId, 'added since the baseline');
      else if (before && after && before !== after) add(modId, `updated ${before} → ${after}`);
    }
  }

  for (const hook of problem.hooks ?? []) {
    if (hook.flag) add(hook.mod, `${hook.flag} hook ${hookParts(hook.hook).handler} (${round(hook.pct)})`);
  }

  for (const pass of (problem.passes?.passes ?? []).slice(0, 3)) {
    for (const [hook, pct] of pass.hooks) add(hookParts(hook).mod, `hooks the ${pass.name} pass (${round(pct)})`);
    for (const [owner, pct] of pass.owners) if (pct >= 2) add(owner, `owns ${round(pct)} of the ${pass.name} pass`);
  }

  const wall = problem.wall_ms ?? 0;
  if (wall > 0) {
    for (const [modId, ms] of Object.entries(problem.by_mod)) {
      const pct = (ms / wall) * 100;
      if (pct >= 2) add(modId, `${round(pct)} self time`);
    }
  }

  return new Map([...suspects].slice(0, limit));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PolyHelperError(`${label} timed out`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function relevantGate(gate: Gate | null): Gate | null {
  if (!gate) return null;
  const modIds = gate.modIds.filter(isScannable);
  if (modIds.length === 0 && gate.kinds.every((kind) => kind === 'mod ID constant')) return null;
  return { ...gate, modIds };
}

function words(text: string): string[] {
  return text
    .split(/(?=[A-Z])|[^A-Za-z]/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3);
}

function relevance(path: string, hints: string[]): number {
  const file = path.split('/').at(-1)?.toLowerCase() ?? path.toLowerCase();
  return hints.filter((hint) => file.includes(hint)).length;
}

function describeGate(gate: Gate, relation: string): string {
  const ids = gate.modIds.length > 0 ? ` · names loaded mods ${gate.modIds.join(', ')}` : '';
  return `gate in ${toDotted(gate.className)} (${relation}): ${gate.kinds.join(', ')}${ids}`;
}

function describeHook(scanned: ScannedMod, hook: HookRow, loadedMods: Set<string>): string[] {
  const { handler } = hookParts(hook.hook);
  const header = `- hook ${handler} on ${hook.on}: ${round(hook.pct)} of thread, ${Math.round(hook.pass_through * 100)}% in the original${hook.flag ? `, ${hook.flag}` : ''}`;
  const jar = scanned.jar;
  if (!jar) return [header];
  const mixins = findMixinsForHook(jar, handler, hook.on);
  if (mixins.length === 0) return [header, '  - no mixin class with this handler found in the jar'];
  const lines = [header];
  for (const mixin of mixins.slice(0, 2)) {
    lines.push(`  - mixin ${toDotted(mixin.name)}`);
    const own = relevantGate(findGate(mixin, loadedMods, jar.modId));
    if (own) lines.push(`    - ${describeGate(own, 'the mixin itself')}`);
    for (const plugin of getPluginClasses(jar, mixin)) {
      const gate = relevantGate(findGate(plugin, loadedMods, jar.modId));
      lines.push(
        `    - mixin plugin ${toDotted(plugin.name)}${gate?.modIds.length ? ` names loaded mods ${gate.modIds.join(', ')}` : ''}`
      );
    }
    for (const referenced of getReferencedClasses(jar, mixin)) {
      const gate = relevantGate(findGate(referenced, loadedMods, jar.modId));
      if (gate) lines.push(`    - ${describeGate(gate, 'called by the mixin')}`);
    }
  }
  return lines;
}

function describeMod(scanned: ScannedMod, problem: ProfileSummary, loadedMods: Set<string>): string {
  const lines = [`## ${scanned.modId} ${scanned.version ?? '?'}: ${scanned.reasons.join('; ')}`];
  const where = scanned.repo ? `GitHub ${scanned.repo} @ ${scanned.ref ?? 'default branch'}` : 'no source repo found';
  lines.push(`source: jar ${scanned.jarNote ?? 'not scanned'} · ${where}${scanned.polyfrost ? ' · Polyfrost' : ''}`);

  const allHooks = (problem.hooks ?? []).filter((hook) => hook.mod === scanned.modId);
  const flagged = allHooks.some((hook) => hook.flag !== null);
  const hooks = allHooks
    .sort((a, b) => Number(Boolean(b.flag)) - Number(Boolean(a.flag)) || b.pct - a.pct)
    .slice(0, flagged ? 4 : 2);
  for (const hook of hooks) lines.push(...describeHook(scanned, hook, loadedMods));

  if (scanned.jar) {
    const jar = scanned.jar;
    const plugins = [...new Set(jar.mixinConfigs.map((config) => config.plugin).filter(Boolean))];
    lines.push(
      `- ${jar.classes.size} classes, ${jar.mixinConfigs.length} mixin configs${plugins.length ? `, plugins ${plugins.join(', ')}` : ''}`
    );
    const gates = [...jar.classes.values()]
      .map((info) => relevantGate(findGate(info, loadedMods, jar.modId)))
      .filter((gate): gate is Gate => gate !== null && gate.modIds.length > 0)
      .slice(0, flagged ? 6 : 3);
    for (const gate of gates) lines.push(`- ${describeGate(gate, 'anywhere in the jar')}`);
    if (gates.length === 0) lines.push('- no class in the jar mentions another loaded mod ID');
  }

  const hints = [
    ...new Set([
      ...hooks.filter((hook) => hook.flag !== null).flatMap((hook) => words(hookParts(hook.hook).handler)),
      ...(problem.passes?.passes ?? []).slice(0, 3).flatMap((pass) => words(pass.name))
    ])
  ];
  const named = scanned.sourceGates
    .filter((gate) => gate.modIds.length > 0)
    .sort((a, b) => relevance(b.path, hints) - relevance(a.path, hints));
  const generic = scanned.sourceGates.filter((gate) => gate.modIds.length === 0).slice(0, 2);
  const sourceGates = [...named, ...generic].slice(0, 8);
  for (const gate of sourceGates) {
    const loaded = gate.modIds.length > 0 ? ` · names loaded mods ${gate.modIds.join(', ')}` : '';
    lines.push(`- source gate \`${gate.text.slice(0, 120)}\`${loaded} · ${gate.url}`);
  }
  if (!scanned.jar && scanned.repo && sourceGates.length === 0) lines.push('- source scan found no isModLoaded calls');
  const text = lines.join('\n');
  const limit = flagged ? maxFlaggedModChars : maxModChars;
  return text.length > limit ? `${text.slice(0, limit)}\n[section truncated]` : text;
}

function buildDigest(
  problem: ProfileSummary,
  scanned: ScannedMod[],
  failed: string[],
  loadedMods: Set<string>
): string {
  const header = `Profile: MC ${problem.meta.mc_version ?? '?'} · ${problem.meta.loader ?? '?'} · ${problem.mods.length} mods`;
  const sections = scanned.map((mod) => describeMod(mod, problem, loadedMods));
  if (failed.length > 0) sections.push(`Not scanned: ${failed.join('; ')}`);
  let body = [header, ...sections].join('\n\n');
  if (body.length > maxDigestChars) body = `${body.slice(0, maxDigestChars)}\n[jar scan truncated]`;
  return `<jar_scan>\n${body}\n</jar_scan>`;
}

export async function scanMod(
  modId: string,
  reasons: string[],
  problem: ProfileSummary,
  loadedMods: Set<string>,
  config: Config['sparkAnalysis']
): Promise<ScannedMod> {
  const version = problem.mod_versions[modId] ?? null;
  const mcVersion = problem.meta.mc_version;
  const loader = problem.meta.loader?.toLowerCase() ?? null;
  const source = await findModSource(modId);
  const scanned: ScannedMod = {
    modId,
    version,
    reasons,
    title: source.project?.title ?? modId,
    iconUrl: source.project?.icon_url ?? null,
    issuesUrl: source.project?.issues_url ?? null,
    repo: source.repo,
    ref: null,
    polyfrost: source.polyfrost,
    jar: null,
    jarNote: null,
    sourceGates: []
  };

  if (!source.project) {
    scanned.jarNote = 'not on Modrinth';
  } else if (!version) {
    scanned.jarNote = 'spark did not report a version';
  } else {
    const match = await findModrinthVersion(source.project.id, version, mcVersion, loader);
    const file = match?.version.files.find((entry) => entry.primary) ?? match?.version.files.at(0);
    if (!match || !file) {
      scanned.jarNote = `no Modrinth file for ${version}`;
    } else {
      const data = await downloadJar(file, config.jarCache.location, 50 * megabyte, config.jarCache.maxMB * megabyte);
      scanned.jar = readJar(data);
      scanned.jarNote = match.exact ? 'exact version' : `closest Modrinth version ${match.version.version_number}`;
    }
  }

  if (scanned.repo) scanned.ref = await resolveRef(scanned.repo, version, mcVersion).catch(() => null);
  if (!scanned.jar && scanned.repo) {
    scanned.sourceGates = await scanSourceGates(scanned.repo, scanned.ref, loadedMods, modId).catch(() => []);
  }
  return scanned;
}

export async function runPrepass(job: SparkJob, config: Config['sparkAnalysis']): Promise<SparkPrepass> {
  const profiles = job.baseline ? [job.baseline.profilePath, job.profile.profilePath] : [job.profile.profilePath];
  const [json, textReport] = await Promise.all([
    runScript(config.python, [...profiles, '--json', '--top', '10'], null),
    runScript(config.python, [...profiles, '--top', '10'], maxReportChars)
  ]);
  const summaries = JSON.parse(json) as ProfileSummary[];
  const problem = summaries.at(-1);
  if (!problem) throw new PolyHelperError('spark_analyze.py returned no profile data');
  const baseline = summaries.length > 1 ? (summaries[0] ?? null) : null;
  const loadedMods = new Set([...problem.mods, ...Object.keys(problem.mod_versions ?? {})]);

  const suspects = pickSuspects(problem, baseline, config.maxJars);
  const results = await Promise.allSettled(
    [...suspects].map(([modId, reasons]) =>
      withTimeout(scanMod(modId, reasons, problem, loadedMods, config), scanTimeoutMs, `Scanning ${modId}`)
    )
  );
  const scanned: ScannedMod[] = [];
  const failed: string[] = [];
  results.forEach((result, index) => {
    const modId = [...suspects.keys()][index] as string;
    if (result.status === 'fulfilled') scanned.push(result.value);
    else failed.push(`${modId} (${getErrorMessage(result.reason)})`);
  });

  return {
    problem,
    baseline,
    textReport,
    digest: buildDigest(problem, scanned, failed, loadedMods),
    scanned,
    loadedMods,
    mcVersion: problem.meta.mc_version,
    loader: problem.meta.loader
  };
}
