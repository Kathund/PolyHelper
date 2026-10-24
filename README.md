# PolyHelper

a bot to do misc things for the Polyfrost server

## running

1. clone it
2. copy `config.example.json` to `config.json` and fill it out
3. `pnpm install --frozen-lockfile`
4. `pnpm start`

## spark analysis

`/spark <link>` hands a spark profile to two Claude agents. Both run the `skills/spark-analyzer` skill on the bot's
host. One posts an analysis for support in the `sparkAnalysis` channel, the other posts a fix brief for developers in
the `sparkFixes` channel, ready to paste into their coding agent.

1. install Python 3. Set `sparkAnalysis.python` if it isn't `python3` on your `PATH`
2. set `sparkAnalysis.enabled` to `true` and fill in `sparkAnalysis.anthropicApiKey`
3. optionally set `sparkAnalysis.githubToken` so the fix agent can search mod source code
