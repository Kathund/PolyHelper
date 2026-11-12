import BasicScript from '../BasicScript.ts';
import { getBundleTypeMods, getBundleTypes, getBundlesMetadata } from '../../utils/dataStorageUtils.ts';
import { getModrinthProject } from '../../utils/modrinthUtils.ts';
import type ScriptManager from '../ScriptManager.ts';
import type { DatabaseProject } from '../../types/database.ts';
import type { OneClientMod } from '../../types/dataStorage.ts';

class LoadProjectsFromBundlesScript extends BasicScript {
  private readonly source = 'OneClient Bundle';
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'loadProjectsFromBundles' });
  }

  private async getSourceURL(mod: OneClientMod): Promise<DatabaseProject['sourceUrl']> {
    const modrinthId = mod.update.modrinth?.['mod-id'] ?? null;
    if (modrinthId) {
      const modrinthProject = await getModrinthProject(modrinthId);
      if (modrinthProject?.source_url) return modrinthProject.source_url;
    }
    if (mod.update.github?.slug) return `https://github.com/${mod.update.github.slug}`;
    return null;
  }

  override async execute(): Promise<void> {
    const bundles = await getBundlesMetadata();
    if (!bundles?.versions) return;
    for (const [version, loaders] of Object.entries(bundles.versions)) {
      if (!loaders) continue;
      for (const loader of Object.keys(loaders)) {
        const types = await getBundleTypes(version, loader);
        for (const type of types) {
          const mods = await getBundleTypeMods(version, loader, type);
          for (const mod of mods) {
            if (this.scripts.application.database.getProjectByName(mod.name)) continue;
            const modrinthId = mod.update.modrinth?.['mod-id'] ?? null;
            if (modrinthId && this.scripts.application.database.getProjectByModrinthId(modrinthId)) continue;
            this.scripts.application.database.insertProject({
              name: mod.name,
              source: this.source,
              sourceUrl: await this.getSourceURL(mod),
              modrinthId,
              notes: null
            });
          }
        }
      }
    }
  }
}

export default LoadProjectsFromBundlesScript;
