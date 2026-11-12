import BasicScript from '../BasicScript.ts';
import { getOrganizationRepositories } from '../../utils/githubUtils.ts';
import type ScriptManager from '../ScriptManager.ts';

class LoadProjectsFromGithubReposScript extends BasicScript {
  private readonly source = 'Polyfrost Repo';
  constructor(scripts: ScriptManager) {
    super(scripts, { id: 'loadProjectsFromGithubRepos' });
  }

  override async execute(): Promise<void> {
    const repos = await getOrganizationRepositories().then((repos) =>
      repos
        .filter((repo) => !repo.archived && !repo.fork && !repo.private)
        .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
    );
    for (const repo of repos) {
      if (this.scripts.application.database.getProjectByName(repo.name)) continue;
      this.scripts.application.database.insertProject({
        name: repo.name,
        source: this.source,
        sourceUrl: repo.html_url,
        modrinthId: null,
        notes: null
      });
    }
  }
}

export default LoadProjectsFromGithubReposScript;
