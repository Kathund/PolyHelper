import Application from '../Application.ts';
import { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { MinimalRepository } from '../types/github.ts';

export async function githubRequest<T>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
  const headers = new AxiosHeaders(config.headers as AxiosHeaders | undefined);
  if (!headers.has('X-GitHub-Api-Version')) headers.set('X-GitHub-Api-Version', '2026-03-10');
  if (!headers.has('Accept')) headers.set('Accept', 'application/vnd.github+json');
  return await Application.request<T>(url, { ...config, headers });
}

export async function githubPaginate<T>(url: string, config: AxiosRequestConfig = {}): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | undefined = url;
  const params = { ...config.params, per_page: config.params?.per_page ?? 100 };

  while (nextUrl) {
    const response: AxiosResponse<T[]> = await githubRequest<T[]>(nextUrl, {
      ...config,
      params: nextUrl === url ? params : undefined
    });
    if (Array.isArray(response.data)) results.push(...response.data);
    if (!response.headers) break;
    const linkHeader: string | undefined = response.headers.link;
    if (!linkHeader) break;

    const nextLink = linkHeader
      .split(',')
      .map((link) => link.trim())
      .find((link) => /;\s*rel="next"/i.test(link));
    nextUrl = nextLink?.match(/<([^>]+)>/)?.[1];
  }

  return results;
}

export async function getRepoCount() {
  const cached = Application.cache.get<number>('github:repo:count');
  if (cached) return cached;
  const repos = await githubPaginate<MinimalRepository>('https://api.github.com/orgs/polyfrost/repos');
  return Application.cache.set<number>('github:repo:count', repos.length);
}

export const githubRepoRegex = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?]|$)/i;
export function getGithubRepo(url: string | null | undefined): string | undefined {
  const match = url?.match(githubRepoRegex);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function getContentsURL(repo: string, path: string): string {
  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
}
