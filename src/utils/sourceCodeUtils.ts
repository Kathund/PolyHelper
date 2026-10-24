import Application from '../Application.ts';
import PolyHelperError from '../private/error.ts';
import zod from 'zod';
import { ModrinthProject, ModrinthSearchResponse } from '../types/modrinth.ts';
import { defineTool } from './claudeUtils.ts';
import { getContentsURL, getGithubRepo, githubRequest } from './githubUtils.ts';
import { isAxiosError } from 'axios';
import type { ClientTool } from '../types/claude.ts';
import type { CodeSearchResponse, ContentEntry } from '../types/github.ts';

const maxFileLines = 250;
const modrinthBaseURL = 'https://api.modrinth.com/v2';

const repoInput = zod
  .string()
  .regex(/^[\w.-]+\/[\w.-]+$/)
  .describe('GitHub repository as "owner/name"');
const refInput = zod.string().optional().describe('Branch, tag or commit SHA. Defaults to the default branch');

async function getModrinthProject(idOrSlug: string): Promise<ModrinthProject | undefined> {
  try {
    const response = await Application.request(`${modrinthBaseURL}/project/${encodeURIComponent(idOrSlug)}`);
    return await ModrinthProject.parseAsync(response.data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return undefined;
    throw error;
  }
}

async function searchModrinth(query: string): Promise<ModrinthProject | undefined> {
  const response = await Application.request(`${modrinthBaseURL}/search`, {
    params: { query, facets: JSON.stringify([['project_type:mod']]), limit: 1 }
  });
  const hit = (await ModrinthSearchResponse.parseAsync(response.data)).hits.at(0);
  return hit ? await getModrinthProject(hit.slug) : undefined;
}

const lookupMod = defineTool({
  name: 'lookup_mod',
  description:
    'Look up a mod on Modrinth by the mod ID that spark reports, or by its name. Returns the source repository, the issue tracker, and whether Polyfrost owns it.',
  input: zod.object({ mod: zod.string().min(1).describe('Mod ID or name, e.g. "sodium"') }),
  run: async ({ mod }) => {
    const project = (await getModrinthProject(mod)) ?? (await searchModrinth(mod));
    if (!project) {
      return `No Modrinth project found for "${mod}". Try its display name, or search GitHub with what you know.`;
    }
    const repo = getGithubRepo(project.source_url);
    return JSON.stringify({
      title: project.title,
      slug: project.slug,
      description: project.description,
      modrinthURL: `https://modrinth.com/mod/${project.slug}`,
      sourceURL: project.source_url ?? null,
      issuesURL: project.issues_url ?? null,
      githubRepo: repo ?? null,
      polyfrost: repo?.split('/')[0]?.toLowerCase() === 'polyfrost'
    });
  }
});

function searchCode(token: string | null = null): ClientTool {
  return defineTool({
    name: 'github_search_code',
    description:
      'Search code in one GitHub repository. Only the default branch is indexed. Returns matching file paths.',
    input: zod.object({
      repo: repoInput,
      query: zod.string().min(1).describe('Search terms, such as a class or method name')
    }),
    run: async ({ repo, query }) => {
      if (!token) {
        throw new PolyHelperError(
          'Code search needs a GitHub token, and none is configured. Browse with github_list_directory instead.'
        );
      }
      const response = await githubRequest<CodeSearchResponse>('https://api.github.com/search/code', {
        params: { q: `${query} repo:${repo}`, per_page: 20 },
        headers: { Authorization: token !== null ? `Bearer ${token}` : undefined }
      });
      if (response.data.items.length === 0) {
        return 'No matches. Code search only covers the default branch; browse with github_list_directory instead.';
      }
      return response.data.items.map((item) => item.path).join('\n');
    }
  });
}

function listDirectory(token: string | null = null): ClientTool {
  return defineTool({
    name: 'github_list_directory',
    description: 'List the files and folders at a path in a GitHub repository.',
    input: zod.object({
      repo: repoInput,
      path: zod.string().default('').describe('Folder path, empty for the root'),
      ref: refInput
    }),
    run: async ({ repo, path, ref }) => {
      const response = await githubRequest<ContentEntry[] | ContentEntry>(getContentsURL(repo, path), {
        params: { ref },
        headers: { Authorization: token !== null ? `Bearer ${token}` : undefined }
      });
      if (!Array.isArray(response.data)) return `${path} is a file. Use github_read_file to read it.`;
      return response.data.map((entry) => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`).join('\n');
    }
  });
}

function readFile(token: string | null = null): ClientTool {
  return defineTool({
    name: 'github_read_file',
    description: `Read a file from a GitHub repository, with line numbers. Returns at most ${maxFileLines} lines per call; use startLine to page through longer files.`,
    input: zod.object({
      repo: repoInput,
      path: zod.string().min(1),
      ref: refInput,
      startLine: zod.number().int().min(1).default(1),
      endLine: zod.number().int().min(1).optional()
    }),
    run: async ({ repo, path, ref, startLine, endLine }) => {
      const response = await githubRequest<string>(getContentsURL(repo, path), {
        params: { ref },
        headers: {
          Authorization: token !== null ? `Bearer ${token}` : undefined,
          Accept: 'application/vnd.github.raw+json'
        },
        responseType: 'text'
      });
      if (String(response.headers['content-type'] ?? '').includes('application/json')) {
        return `${path} is not a file. Use github_list_directory to browse it.`;
      }
      const lines = response.data.split('\n');
      const end = Math.min(endLine ?? lines.length, startLine + maxFileLines - 1, lines.length);
      const body = lines
        .slice(startLine - 1, end)
        .map((line, i) => `${startLine + i}: ${line}`)
        .join('\n');
      return `${path} (lines ${startLine}-${end} of ${lines.length})\n${body}`;
    }
  });
}

export default function getSourceTools(githubToken: string | null): ClientTool[] {
  return [lookupMod, searchCode(githubToken), listDirectory(githubToken), readFile(githubToken)];
}
