import PolyHelperError from '../private/error.ts';
import zod from 'zod';
import { SparkReport } from '../types/spark.ts';
import { defineTool, runCompletion } from '../utils/claudeUtils.ts';
import {
  findModSource,
  getBlobURL,
  getFileText,
  listDirectory,
  resolveRef,
  searchCode
} from '../utils/sourceCodeUtils.ts';
import { runScript } from '../utils/sparkUtils.ts';
import { scanMod } from './SparkPrepass.ts';
import { toDotted, toInternal } from '../utils/jarUtils.ts';
import type Anthropic from '@anthropic-ai/sdk';
import type { ClientTool } from '../types/claude.ts';
import type { Config } from '../types/config.ts';
import type { CostTracker } from '../utils/claudeUtils.ts';
import type { ScannedMod, SparkJob, SparkPrepass } from '../types/spark.ts';

const maxScriptOutput = 6000;

const maxReadLines = 60;

const maxHelperChars = 200_000;

const maxExtraScans = 2;
const agentRequestReason = 'requested by the agent';

const helperSystem =
  'You read one source file for a performance investigator. Answer the question using only this file. Cite line numbers like L42 for every claim. Quote the exact condition when the question is about a check or gate. Keep it under 150 words. If the file does not answer the question, say so.';

const repoInput = zod
  .string()
  .regex(/^[\w.-]+\/[\w.-]+$/)
  .describe('GitHub repository as "owner/name"');

const refInput = zod
  .string()
  .optional()
  .describe("Branch, tag or commit. Defaults to the ref matching the profile's mod version");

function defaultRef(context: SparkToolContext, repo: string): string | null {
  return context.prepass.scanned.find((mod) => mod.repo?.toLowerCase() === repo.toLowerCase())?.ref ?? null;
}

async function getScannedMod(context: SparkToolContext, modId: string): Promise<ScannedMod> {
  const existing = context.prepass.scanned.find((mod) => mod.modId === modId);
  if (existing?.jar) return existing;
  if (existing) throw new PolyHelperError(`No jar for ${modId}: ${existing.jarNote ?? 'not scanned'}`);
  if (!context.prepass.loadedMods.has(modId)) throw new PolyHelperError(`${modId} is not loaded in this profile`);
  const extra = context.prepass.scanned.filter((mod) => mod.reasons.includes(agentRequestReason)).length;
  if (extra >= maxExtraScans) throw new PolyHelperError('No more jars can be scanned for this analysis');
  const scanned = await scanMod(
    modId,
    [agentRequestReason],
    context.prepass.problem,
    context.prepass.loadedMods,
    context.config
  );
  context.prepass.scanned.push(scanned);
  if (!scanned.jar) throw new PolyHelperError(`No jar for ${modId}: ${scanned.jarNote ?? 'not found'}`);
  return scanned;
}

function sparkAnalyzeTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'spark_analyze',
    description:
      "Run the spark-analyzer skill's spark_analyze.py on the profile and return its output. The profile, and the baseline in compare mode, are passed for you; set only the options. The top-10 report is already in your first message.",
    input: zod.object({
      thread: zod.string().min(1).optional().describe('Thread to focus on. Use "Server thread" for TPS lag'),
      top: zod.number().int().min(1).max(50).optional().describe('Rows to print, default 25'),
      tree: zod
        .string()
        .min(1)
        .optional()
        .describe('Inclusive-time call tree under frames whose Class.method contains this'),
      treeMin: zod.number().min(0).max(100).optional().describe('Prune tree branches below this %, default 0.15'),
      treeDepth: zod.number().int().min(1).max(40).optional().describe('Maximum tree depth, default 20'),
      callers: zod
        .string()
        .min(1)
        .optional()
        .describe('Self-time of frames whose Class.method contains this, by caller chain'),
      callersDepth: zod.number().int().min(1).max(20).optional().describe('Callers per chain, default 4'),
      hookMin: zod.number().min(0).max(100).optional().describe('Smallest hook in the hook audit, default 1.0'),
      mods: zod.boolean().optional().describe('Also print the full loaded-mod list with versions'),
      all: zod.boolean().optional().describe('Also print the all-threads ranking')
    }),
    run: async (options) => {
      const { job } = context;
      const args = job.baseline ? [job.baseline.profilePath, job.profile.profilePath] : [job.profile.profilePath];
      if (options.thread) args.push('--thread', options.thread);
      if (options.top) args.push('--top', String(options.top));
      if (options.tree) args.push('--tree', options.tree);
      if (options.treeMin !== undefined) args.push('--tree-min', String(options.treeMin));
      if (options.treeDepth) args.push('--tree-depth', String(options.treeDepth));
      if (options.callers) args.push('--callers', options.callers);
      if (options.callersDepth) args.push('--callers-depth', String(options.callersDepth));
      if (options.hookMin !== undefined) args.push('--hook-min', String(options.hookMin));
      if (options.mods) args.push('--mods');
      if (options.all) args.push('--all');
      return await runScript(context.config.python, args, maxScriptOutput);
    }
  });
}

function jarSearchTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'jar_search',
    description:
      "Search a mod's jar (the exact version in the profile, from Modrinth) for classes whose bytecode constants contain the text: string literals, class, method and field names. Mods not in the jar scan are downloaded on demand, at most two.",
    input: zod.object({
      mod: zod.string().min(1).describe('Mod ID as spark shows it'),
      text: zod.string().min(2).describe('Text to find, e.g. a mod ID, a method name or a config key')
    }),
    run: async ({ mod, text }) => {
      const scanned = await getScannedMod(context, mod);
      const hits: string[] = [];
      for (const info of scanned.jar?.classes.values() ?? []) {
        const matches = [...new Set([...info.utf8, ...info.strings].filter((value) => value.includes(text)))];
        if (matches.length === 0) continue;
        hits.push(
          `${toDotted(info.name)}: ${matches
            .slice(0, 3)
            .map((value) => JSON.stringify(value))
            .join(', ')}`
        );
        if (hits.length >= 25) break;
      }
      return hits.length > 0 ? hits.join('\n') : `No class in ${mod} contains "${text}"`;
    }
  });
}

function jarClassTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'jar_class',
    description:
      "Show one class from a mod's jar: its superclass, interfaces, method names, the methods it calls and its string literals. Use it to confirm a gate without the source.",
    input: zod.object({
      mod: zod.string().min(1).describe('Mod ID as spark shows it'),
      className: zod.string().min(1).describe('Fully qualified class name, dotted or slashed')
    }),
    run: async ({ mod, className }) => {
      const scanned = await getScannedMod(context, mod);
      const info = scanned.jar?.classes.get(toInternal(className));
      if (!info) throw new PolyHelperError(`${className} is not in ${mod}'s jar. Find it with jar_search`);
      const calls = [...new Set(info.methodRefs.map((ref) => `${toDotted(ref.owner)}.${ref.name}`))];
      return [
        `class ${toDotted(info.name)} extends ${info.superName ? toDotted(info.superName) : 'none'}`,
        `interfaces: ${info.interfaces.map(toDotted).join(', ') || 'none'}`,
        `methods: ${info.methods.slice(0, 60).join(', ')}`,
        `calls: ${calls.slice(0, 60).join(', ')}`,
        `strings: ${info.strings
          .slice(0, 60)
          .map((value) => JSON.stringify(value))
          .join(', ')}`
      ].join('\n');
    }
  });
}

function lookupModTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'lookup_mod',
    description:
      'Look up a mod by the mod ID spark reports: its Modrinth page, source repository, issue tracker, whether Polyfrost owns it, and the git ref matching the version in the profile.',
    input: zod.object({ mod: zod.string().min(1).describe('Mod ID, e.g. "sodium"') }),
    run: async ({ mod }) => {
      const source = await findModSource(mod);
      const version = context.prepass.problem.mod_versions[mod] ?? null;
      const ref = source.repo ? await resolveRef(source.repo, version, context.prepass.mcVersion) : null;
      return JSON.stringify({
        title: source.project?.title ?? null,
        modrinthURL: source.project ? `https://modrinth.com/mod/${source.project.slug}` : null,
        versionInProfile: version,
        githubRepo: source.repo,
        matchingRef: ref,
        issuesURL: source.project?.issues_url ?? null,
        polyfrost: source.polyfrost
      });
    }
  });
}

function searchCodeTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'github_search_code',
    description:
      "Find file paths in a GitHub repository that contain the search terms. Only the default branch is indexed, so read the file at the profile's ref afterwards.",
    input: zod.object({ repo: repoInput, query: zod.string().min(1).describe('Search terms, such as a class name') }),
    run: async ({ repo, query }) => {
      const paths = await searchCode(repo, query);
      return paths.length > 0 ? paths.join('\n') : 'No matches on the default branch.';
    }
  });
}

function listDirectoryTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'github_list_directory',
    description: 'List the files and folders at a path in a GitHub repository.',
    input: zod.object({
      repo: repoInput,
      path: zod.string().default('').describe('Folder path, empty for the root'),
      ref: refInput
    }),
    run: async ({ repo, path, ref }) => {
      const entries = await listDirectory(repo, path, ref ?? defaultRef(context, repo));
      if (!entries) return `${path} is a file. Use read_source or github_read_file.`;
      return entries.map((entry) => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`).join('\n');
    }
  });
}

function readFileTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'github_read_file',
    description: `Read exact lines of a file in a GitHub repository, at most ${maxReadLines} lines per call. Use it to confirm lines that read_source pointed to.`,
    input: zod.object({
      repo: repoInput,
      path: zod.string().min(1),
      ref: refInput,
      startLine: zod.number().int().min(1),
      endLine: zod.number().int().min(1)
    }),
    run: async ({ repo, path, ref, startLine, endLine }) => {
      const resolved = ref ?? defaultRef(context, repo);
      const text = await getFileText(repo, path, resolved);
      if (text === null) throw new PolyHelperError(`${path} was not found at ${resolved ?? 'the default branch'}`);
      const lines = text.split('\n');
      const end = Math.min(endLine, startLine + maxReadLines - 1, lines.length);
      const body = lines
        .slice(startLine - 1, end)
        .map((line, index) => `${startLine + index}: ${line}`)
        .join('\n');
      return `${getBlobURL(repo, resolved, path, startLine)} (lines ${startLine}-${end} of ${lines.length})\n${body}`;
    }
  });
}

function readSourceTool(context: SparkToolContext): ClientTool {
  return defineTool({
    name: 'read_source',
    description:
      'Ask a question about one source file without reading it yourself. A smaller model reads the whole file and answers with line numbers. Its answer is a lead: confirm anything you report as confirmed with github_read_file or jar_class.',
    input: zod.object({
      repo: repoInput,
      path: zod.string().min(1),
      question: zod.string().min(5).describe('What you need from the file, e.g. "what makes canDefer() return false?"'),
      ref: refInput
    }),
    run: async ({ repo, path, question, ref }) => {
      const resolved = ref ?? defaultRef(context, repo);
      const text = await getFileText(repo, path, resolved);
      if (text === null) throw new PolyHelperError(`${path} was not found at ${resolved ?? 'the default branch'}`);
      const numbered = text
        .split('\n')
        .map((line, index) => `${index + 1}: ${line}`)
        .join('\n')
        .slice(0, maxHelperChars);
      const answer = await runCompletion(
        {
          client: context.client,
          label: `spark-helper ${path}`,
          model: context.config.helperModel,
          system: helperSystem,
          prompt: `<file path="${path}" ref="${resolved ?? 'default'}">\n${numbered}\n</file>\n\nQuestion: ${question}`,
          effort: 'low',
          maxTokens: 1000
        },
        context.tracker
      );
      return `${answer}\n\nFile: ${getBlobURL(repo, resolved, path)}`;
    }
  });
}

function submitReportTool(): ClientTool {
  return defineTool({
    name: submitReportName,
    description:
      'Submit your final report. Call this exactly once, when you are done or when told your budget is reached. The bot formats it for Discord, so write plain sentences and markdown, never tables.',
    input: SparkReport,
    strict: true,
    run: () => Promise.resolve('Report received.')
  });
}

export interface SparkToolContext {
  job: SparkJob;
  prepass: SparkPrepass;
  config: Config['sparkAnalysis'];
  client: Anthropic;
  tracker: CostTracker;
}

export const submitReportName = 'submit_report';

export function getSparkTools(context: SparkToolContext): ClientTool[] {
  const tools = [
    sparkAnalyzeTool(context),
    jarSearchTool(context),
    jarClassTool(context),
    lookupModTool(context),
    listDirectoryTool(context),
    readFileTool(context),
    readSourceTool(context),
    submitReportTool()
  ];
  if (context.config.githubToken) tools.splice(4, 0, searchCodeTool(context));
  return tools;
}
