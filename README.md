# PolyHelper

a bot to do misc things for the Polyfrost server

## running

1. clone it
2. copy `config.example.json` to `config.json` and fill it out
3. `pnpm install --frozen-lockfile`
4. `pnpm start`

## spark analysis

`/spark analyze <link>` hands a spark profile to one Claude agent running the `skills/spark-analyzer` skill on the bot's
host. Before the agent starts, the bot scans the jars of the suspect mods (the exact versions from Modrinth) for
bail-out gates, such as a mod turning an optimization off because another mod is loaded. When a mod has no jar on
Modrinth, it scans the mod's source on GitHub instead. The agent can ask a smaller model to read source files for it.

The full analysis, including a dev handoff when a mod's code could fix the problem, is posted in the `sparkAnalysis`
channel. The support team member who ran the command also gets a private summary with a link to it.

`/spark compare <baseline> <link>` does the same for two profiles, such as without and with a mod, and reports what
changed between them. The `Scan Spark Log` message context menu runs `analyze` on the link in a message.

Each analysis has a spend target (`sparkAnalysis.costTarget`), where the agent is told to wrap up, and a hard cap
(`sparkAnalysis.costCap`).

1. install Python 3. Set `sparkAnalysis.python` if it isn't `python3` on your `PATH`
2. set `sparkAnalysis.enabled` to `true` and fill in `sparkAnalysis.anthropicApiKey`
3. optionally set `sparkAnalysis.githubToken` so the agent can search mod source code and scan mods that aren't on
   Modrinth

## docker

### requirements

- [Docker](https://docs.docker.com/get-docker/) >= 20
  - Older versions may also work, but have not been tested.

1. clone it
2. copy `config.example.json` to `config.json` and fill it out

3. Run the container:

The container runs as the `node` user (UID/GID `1000`). Create the folders before starting the container, otherwise
Docker creates them owned by root:

```bash
mkdir -p data
sudo chown -R 1000:1000 config.json data
```

```bash
  docker container run --restart=unless-stopped -itd -v ./config.json:/app/config.json -v ./data/:/app/data/ --name polyhelper ghcr.io/kathund/polyhelper:latest
```

Note that the path of the configuration source file must either be relative (with the `./`) or absolute.
