---
name: spark-analyzer
description: >-
  Analyze spark (spark.lucko.me) profiler / sampler reports to find what is
  costing a Minecraft client or server CPU, FPS or TPS: a mod, a render pass, or
  a mod's optimization silently turned off by another mod. Use this WHENEVER the
  user shares a spark.lucko.me or bytebin.lucko.me link, attaches a spark .bin /
  sampler dump, or asks why their game/server is lagging, dropping frames, or
  losing TPS and points at a spark profile, even if they just paste the URL with
  "what's slow?" or compare two profiles ("with mods vs without"). Do NOT try to
  WebFetch the spark URL (it's a SPA that returns only a loading shell); this
  skill downloads the underlying protobuf.
---

# spark-analyzer

Turn a spark link into evidence: per-mod self-time, per-pass cost, a mixin hook
audit and suspicious GL calls. Then find the cause in code, not in guesses.

## Getting the data

- `spark.lucko.me/<id>` is a SPA; fetching it returns a loading shell. The data is
  a `SamplerData` protobuf at `https://bytebin.lucko.me/<id>`. Always use the
  bundled script; never hand-roll protobuf parsing or scrape the page.
- The schema is spark's official one (`references/*.proto`, copied from
  [lucko/spark](https://github.com/lucko/spark) `spark-common/src/main/proto/spark/`
  at `4188f0c`). If a newer spark breaks parsing, re-copy those files and fix the
  field numbers. Never guess them from raw bytes.
- If Python can't verify bytebin's TLS certificate, the script retries with
  `certifi`, then `curl`, and says so. If downloading fails entirely, ask for the
  `.bin` and pass the path.
- Last resort if parsing fails: `https://spark.lucko.me/<id>?raw=1&full=true`
  returns JSON with named keys.

## Usage

```bash
python3 scripts/spark_analyze.py <url-or-id-or-file> [more...]
```

One profile prints the full report. Two or more add a mod-set diff and a
side-by-side table.

- `--thread NAME`: focus thread. Default `Render thread` / `Client thread` (FPS).
  Use `"Server thread"` for TPS. `--all` adds the all-threads ranking.
- `--top N`: rows per table (default 25).
- `--tree SUBSTR`: inclusive call tree under every frame whose `Class.method`
  contains SUBSTR. Tune with `--tree-min PCT` (0.15) and `--tree-depth N` (20).
- `--callers PATTERN`: who calls a frame. Self-time of matching frames grouped by
  caller chain; comma-separate patterns; `--callers-depth N` (4).
- `--hook-min PCT`: smallest hook in the hook audit (1.0).
- `--mods`: the full loaded-mod list with versions.
- `--json`: everything, machine-readable.

## Workflow

Do these in order. Don't skip to a verdict.

1. **Header and `system:` line.** Note the CPU, RAM, heap and GC, and every
   `hint:` line. Hints are inference (spark records no GPU), so use them to
   weigh findings, never as the finding.
2. **By-mod table.** Self-time only, so it hides cost that lands in natives,
   the JVM or vanilla code a mod calls. Never dismiss a mod for being under 2%.
3. **Frame breakdown and render passes.** Find the heavy pass and who owns its
   cost. A pass that is heavy for what it draws (the sky, a blit, a HUD) is a lead.
4. **Hook audit.** Every `PASS-THROUGH` row is a lead: a fast-path hook that ran
   straight into the original. Also check any optimization mod's hooks on the
   heaviest passes, flagged or not.
5. **Read the source for bail-out gates** on every lead (see Finding mod source).
   Look for `isModLoaded(`, `ModList.get().isLoaded(`, mixin plugins
   (`shouldApplyMixin`), config toggles and early `return original.call(...)`
   paths in the hook. Check each gated mod ID against `--mods`. A hit is a
   finding: "<feature> in <mod> is off because <other mod> is loaded."
6. **`--tree` / `--callers`** on whatever is still unexplained.
7. **Only then** talk about hardware limits.

## Reading the output

- **Percentages are of the thread's sampled time** (`ThreadNode.times`, shown as
  "Xs sampled"). That can be less than `dur=`: the Java sampler records time only
  for the samples it takes. Percentages compare across profiles; raw ms don't.
- **Idle frames** (`park`, `epoll`, `mach_msg2_trap`, ...) are in the
  denominator. Lots of idle means headroom.
- **Self-time goes to the owning mod.** Mixins merged into vanilla classes are
  credited via spark's `method_sources` / `line_sources`. `gl-native` is time in
  LWJGL natives (GL calls, buffer swap); `unknown` is code spark couldn't place.
- **Mixin hooks** look like `wrapMethod$ihk000$<mod>$<name>`. In the hook audit,
  `pass` is the share of the hook's time spent in the original method and `own`
  the share in its mod's other code.
- **Zero idle plus a large `gl-native` share means GPU- or driver-bound. That is
  not "nothing actionable".** The actionable items are GPU work: overdraw, a
  disabled optimization (deferral, culling, early-Z), extra full-screen passes,
  redundant draws, resolution. A stall lands in whichever GL call blocks, so a
  single call is unreliable on its own. Per-pass totals and the "suspicious GL
  calls" list point at the heavy pass: a cheap call (bind, use program, fence)
  or one small primitive (sky disc, sun, a blit) costing 1% or more means the GPU
  work around it is heavy.
- **spark sees no GPU time or GPU model, and doesn't sample GC threads.** The
  `gc during capture:` line is the only per-capture GC evidence;
  `gc since jvm start` is cumulative.
- **`Thread.run [jvm]` at the top of a render thread** is the unwalkable native
  top frame, not a mod cost.
- **Load-time or GPU-only mods** (shader patchers, resource-pack mods) read ~0 CPU.
  That means "not costing render-thread CPU", not "doing nothing".
- **Windows swap figures are misleading.** `swap.used` is committed memory and
  `swap.total` the commit limit, not the page file.
- **`ALLOCATION profile`** means every figure is bytes allocated, not time.

## Comparing two profiles

1. Run both in one invocation.
2. State exactly which mods differ from the mod-set diff. Packs are rarely a
   clean superset, whatever the user says. Libraries are counted, not listed.
3. Compare the `%` tables, pass breakdowns and hook audits. A pass or hook whose
   share moved is the candidate. If the pies barely moved but FPS changed, the
   cost moved to the GPU or GC: compare `gl-native`, the suspicious GL calls and
   `gc during capture:`.
4. Check comparability from the headers. Very different entity counts or TPS
   mean a confounded comparison. Say so.

## Reporting

- Lead with actionable findings, ranked. Each one: evidence (frames and %), then
  the mechanism, then how to verify it, then where to fix it (repo, file, symbol).
- **State a mechanism only if you saw it in code or the profile.** Otherwise
  label it `(hypothesis)`. The profile can't show what a draw call drew.
- If a mod the user develops is involved, the deliverable is a candidate code
  fix in their repo, not "disable mod X".
- Hardware limits come last, after the pass-level waste.
- Keep it tight. Surface the mods and passes that matter, not every row.

## Finding mod source

In this order:
1. A local checkout. Polyfrost mods (Polydium, OneConfig and others) are under
   `D:\Development\Projects\Teams\Polyfrost\`; search there first.
2. The mod's GitHub repo (`gh api`, `gh search code`), found from its Modrinth page.
3. The jar, via the `minecraft-dev` MCP (`decompile_mod_jar`, `search_mod_code`),
   when you know the jar's path.

Read the branch or tag that matches the profile's Minecraft version.

## Regression check

`python3 evals/check.py` asserts the report on `evals/fixtures/4j4veJ7Jan.bin`.
See `evals/README.md`.
