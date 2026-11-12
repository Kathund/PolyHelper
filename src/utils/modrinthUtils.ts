import Application from '../Application.ts';
import zod from 'zod';
import { ModrinthProject, ModrinthSearchResponse, ModrinthVersion } from '../types/modrinth.ts';
import { isAxiosError } from 'axios';

const modrinthBaseURL = 'https://api.modrinth.com/v2';

function versionCore(version: string): string {
  return version.toLowerCase().replace(/^v/, '').split('+')[0] ?? version;
}

export function getModrinthProject(idOrSlug: string): Promise<ModrinthProject | null> {
  return Application.cachedRequest(`modrinth:project:${idOrSlug.toLowerCase()}`, async () => {
    try {
      const response = await Application.request(`${modrinthBaseURL}/project/${encodeURIComponent(idOrSlug)}`);
      return await ModrinthProject.parseAsync(response.data);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  });
}

export function searchModrinthProject(query: string): Promise<ModrinthProject | null> {
  return Application.cachedRequest(`modrinth:search:${query.toLowerCase()}`, async () => {
    const response = await Application.request(`${modrinthBaseURL}/search`, {
      params: { query, facets: JSON.stringify([['project_type:mod']]), limit: 1 }
    });
    const hit = (await ModrinthSearchResponse.parseAsync(response.data)).hits.at(0);
    return hit ? await getModrinthProject(hit.slug) : null;
  });
}

export async function findModrinthProject(modId: string): Promise<ModrinthProject | null> {
  return (await getModrinthProject(modId)) ?? (await searchModrinthProject(modId));
}

export function getModrinthVersions(
  projectId: string,
  gameVersion: string | null,
  loader: string | null
): Promise<ModrinthVersion[]> {
  return Application.cachedRequest(`modrinth:versions:${projectId}:${gameVersion}:${loader}`, async () => {
    const params: Record<string, string> = {};
    if (gameVersion) params.game_versions = JSON.stringify([gameVersion]);
    if (loader) params.loaders = JSON.stringify([loader]);
    const response = await Application.request(`${modrinthBaseURL}/project/${encodeURIComponent(projectId)}/version`, {
      params
    });
    return await zod.array(ModrinthVersion).parseAsync(response.data);
  });
}

export async function findModrinthVersion(
  projectId: string,
  modVersion: string,
  gameVersion: string | null,
  loader: string | null
): Promise<{ version: ModrinthVersion; exact: boolean } | null> {
  let versions = await getModrinthVersions(projectId, gameVersion, loader);
  if (versions.length === 0 && loader) versions = await getModrinthVersions(projectId, gameVersion, null);
  if (versions.length === 0) versions = await getModrinthVersions(projectId, null, null);

  const wanted = modVersion.toLowerCase();
  const exact = versions.find((version) => version.version_number.toLowerCase() === wanted);
  if (exact) return { version: exact, exact: true };

  const core = versionCore(modVersion);
  const loose = versions.find((version) => {
    const candidate = version.version_number.toLowerCase();
    return candidate.includes(core) || wanted.includes(versionCore(candidate));
  });
  return loose ? { version: loose, exact: false } : null;
}
