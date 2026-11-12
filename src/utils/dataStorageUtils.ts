import Application from '../Application.ts';
import { OneClientBundlesMetadata, OneClientMod } from '../types/dataStorage.ts';
import { getFileText, listDirectory } from './sourceCodeUtils.ts';
import { isAxiosError } from 'axios';
import { parseToml } from './miscUtils.ts';

export function getBundlesMetadata(): Promise<OneClientBundlesMetadata | null> {
  return Application.cachedRequest('datastorage:bundles:metadata', async () => {
    try {
      const response = await Application.request<OneClientBundlesMetadata>(
        'https://raw.githubusercontent.com/Polyfrost/DataStorageV2/refs/heads/main/data/oneclient/bundles/metadata.json'
      );
      const parse = await OneClientBundlesMetadata.parseAsync(response.data);
      return parse;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  });
}

export async function getBundleTypes(version: string, loader: string): Promise<string[]> {
  const files = await listDirectory(
    'Polyfrost/DataStorageV2',
    `data/oneclient/bundles/.mrpacks/${version}-${loader}`,
    'main'
  );
  if (!files) return [];
  return files.filter((file) => file.type === 'dir').map((folder) => folder.name);
}

export async function getBundleTypeMods(version: string, loader: string, type: string): Promise<OneClientMod[]> {
  const files = await listDirectory(
    'Polyfrost/DataStorageV2',
    `data/oneclient/bundles/.mrpacks/${version}-${loader}/${type}/mods`,
    'main'
  );
  if (!files) return [];
  const modFiles = files
    .filter((file) => file.type === 'file')
    .filter((file) => file.name.endsWith('.toml'))
    .map((file) => file.path);
  const parsedMods: OneClientMod[] = [];
  for (const modFile of modFiles) {
    const text = await getFileText('Polyfrost/DataStorageV2', modFile, 'main');
    if (text === null) throw new Error(`Unable to load bundle mod manifest: ${modFile}`);
    const mod = parseToml(text, OneClientMod);
    parsedMods.push(mod);
  }
  return parsedMods;
}
