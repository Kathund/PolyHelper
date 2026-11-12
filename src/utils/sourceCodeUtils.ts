import Application from '../Application.ts';
import PolyHelperError from '../private/error.ts';
import { findModrinthProject } from './modrinthUtils.ts';
import { getContentsURL, getGithubRepo, githubRequest } from './githubUtils.ts';
import { isAxiosError } from 'axios';
import type { CodeSearchResponse, ContentEntry } from '../types/github.ts';
import type { ModrinthProject } from '../types/modrinth.ts';

const versionFiles = ['gradle.properties', 'stonecutter.properties.toml', 'settings.gradle.kts'];

const maxBranches = 5;

const maxGateFiles = 8;

function getRepoInfo(repo: string): Promise<RepoInfo | null> {
  return Application.cachedRequest(`source:repo:${repo.toLowerCase()}`, async () => {
    try {
      const response = await githubRequest<RepoInfo>(`https://api.github.com/repos/${repo}`);
      return { full_name: response.data.full_name, default_branch: response.data.default_branch };
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  });
}

function scoreText(text: string, modVersion: string | null, mcVersion: string | null): number {
  let score = 0;
  if (modVersion && text.includes(modVersion)) score += 2;
  if (mcVersion && text.includes(mcVersion)) score += 1;
  return score;
}

async function scoreBranch(
  repo: string,
  branch: string,
  modVersion: string | null,
  mcVersion: string | null
): Promise<number> {
  const texts = await Promise.all(versionFiles.map((file) => getFileText(repo, file, branch).catch(() => null)));
  return Math.max(0, ...texts.map((text) => (text ? scoreText(text, modVersion, mcVersion) : 0)));
}

interface RepoInfo {
  full_name: string;
  default_branch: string;
}

export interface ModSource {
  repo: string | null;
  project: ModrinthProject | null;
  polyfrost: boolean;
}

export interface SourceGateLine {
  path: string;
  line: number;
  text: string;
  modIds: string[];
  url: string;
}

export function findModSource(modId: string): Promise<ModSource> {
  return Application.cachedRequest(`source:mod:${modId.toLowerCase()}`, async () => {
    const project = await findModrinthProject(modId);
    let repo = getGithubRepo(project?.source_url) ?? null;
    if (!repo) repo = (await getRepoInfo(`Polyfrost/${modId}`))?.full_name ?? null;
    return { repo, project, polyfrost: repo?.split('/')[0]?.toLowerCase() === 'polyfrost' };
  });
}

export async function getFileText(repo: string, path: string, ref: string | null): Promise<string | null> {
  try {
    const response = await githubRequest<string>(getContentsURL(repo, path), {
      params: ref ? { ref } : undefined,
      headers: { Accept: 'application/vnd.github.raw+json' },
      responseType: 'text'
    });
    if (String(response.headers['content-type'] ?? '').includes('application/json')) return null;
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function listDirectory(repo: string, path: string, ref: string | null): Promise<ContentEntry[] | null> {
  const response = await githubRequest<ContentEntry[] | ContentEntry>(getContentsURL(repo, path), {
    params: ref ? { ref } : undefined
  });
  return Array.isArray(response.data) ? response.data : null;
}

export async function searchCode(repo: string, query: string): Promise<string[]> {
  if (!process.env.GITHUB_TOKEN) throw new PolyHelperError('Code search needs a GitHub token, and none is configured');
  const response = await githubRequest<CodeSearchResponse>('https://api.github.com/search/code', {
    params: { q: `${query} repo:${repo}`, per_page: 20 }
  });
  return response.data.items.map((item) => item.path);
}

export function resolveRef(repo: string, modVersion: string | null, mcVersion: string | null): Promise<string | null> {
  return Application.cachedRequest(`source:ref:${repo}:${modVersion}:${mcVersion}`, async () => {
    if (modVersion) {
      const tags = await githubRequest<{ ref: string }[]>(
        `https://api.github.com/repos/${repo}/git/matching-refs/tags/`
      ).catch(() => null);
      const names = (tags?.data ?? []).map((tag) => tag.ref.replace(/^refs\/tags\//, ''));
      const matching = names.filter((name) => name.includes(modVersion));
      const best = matching.find((name) => mcVersion && name.includes(mcVersion)) ?? matching.at(0);
      if (best) return best;
    }

    const info = await getRepoInfo(repo).catch(() => null);
    const fallback = info?.default_branch ?? null;
    const branches = await githubRequest<{ name: string }[]>(`https://api.github.com/repos/${repo}/branches`, {
      params: { per_page: 30 }
    }).catch(() => null);
    const names = (branches?.data ?? []).map((branch) => branch.name);
    const named = names.find((name) => mcVersion && name.includes(mcVersion));
    if (named) return named;

    const candidates = [...new Set([fallback, ...names].filter((name): name is string => name !== null))];
    const scored = await Promise.all(
      candidates
        .slice(0, maxBranches)
        .map(async (name) => ({ name, score: await scoreBranch(repo, name, modVersion, mcVersion) }))
    );
    const versionMatch = scored.find((entry) => entry.score >= 2);
    return versionMatch?.name ?? fallback;
  });
}

export function getBlobURL(repo: string, ref: string | null, path: string, line?: number): string {
  return `https://github.com/${repo}/blob/${ref ?? 'HEAD'}/${path}${line ? `#L${line}` : ''}`;
}

export async function scanSourceGates(
  repo: string,
  ref: string | null,
  loadedMods: Set<string>,
  selfId: string
): Promise<SourceGateLine[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  const paths = (await searchCode(repo, 'isModLoaded')).filter((path) => /\.(java|kt)$/.test(path));
  const gates: SourceGateLine[] = [];
  for (const path of paths.slice(0, maxGateFiles)) {
    const text = (await getFileText(repo, path, ref)) ?? (await getFileText(repo, path, null));
    if (!text) continue;
    text.split('\n').forEach((line, index) => {
      const literals = [...line.matchAll(/"([a-z0-9_-]{3,})"/g)].map((match) => match[1] as string);
      const modIds = [...new Set(literals.filter((id) => id !== selfId && loadedMods.has(id)))];
      const code = line.trim();
      if (/^(?:\/\/|\/\*|\*)/.test(code)) return;
      if (modIds.length === 0 && !line.includes('isModLoaded')) return;
      gates.push({
        path,
        line: index + 1,
        text: line.trim().slice(0, 160),
        modIds,
        url: getBlobURL(repo, ref, path, index + 1)
      });
    });
  }
  return gates;
}
