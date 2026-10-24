#!/usr/bin/env python3
"""
spark_analyze.py - parse spark (lucko.me) sampler profiles and attribute CPU
self-time to the mod that owns each frame.

Why this exists: the spark web viewer is a SPA and WebFetch only sees the loading
shell. The real data lives at https://bytebin.lucko.me/<id> as a spark
SamplerData protobuf (content-type application/x-spark-sampler). This script
downloads it, decodes it against spark's official schema
(references/spark_sampler.proto + references/spark.proto) with a minimal stdlib
wire reader (no protobuf dependency), and reports per-mod self-time, the render
passes, a mixin hook audit and suspicious GL calls.

Usage:
    python3 spark_analyze.py <url-or-id-or-file> [more ...]

Accepts spark share URLs (https://spark.lucko.me/AbCd), bare bytebin ids (AbCd),
or local .bin files. Pass two or more to also print a mod-set diff and a
side-by-side comparison of the focus thread.

Options:
    --thread NAME       Focus thread (default: "Render thread" or "Client thread")
    --all               Also print the all-threads ranking (mostly idle/GC/background)
    --top N             How many rows to print (default 25)
    --tree SUBSTR       Print the inclusive-time call tree under frames whose Class.method contains
                        SUBSTR (case-insensitive), e.g. --tree OneConfig.render
    --tree-min PCT      Prune tree branches below this % of the thread (default 0.15)
    --tree-depth N      Max tree depth (default 20)
    --callers PATTERN   Who calls a frame: self-time of frames whose Class.method contains PATTERN,
                        grouped by caller chain. Comma-separate several patterns
    --callers-depth N   Callers to show per chain (default 4)
    --hook-min PCT      Smallest mixin hook to list in the hook audit (default 1.0)
    --mods              Print the full loaded-mod list (id and version)
    --json              Emit machine-readable JSON instead of the text report

If Python can't verify bytebin's TLS certificate, the download retries with certifi, then curl.
"""
import sys, os, struct, collections, urllib.request, urllib.error, gzip, json, re, ssl, shutil, subprocess

BYTEBIN = "https://bytebin.lucko.me/"
SAMPLER_MEDIA_TYPE = "application/x-spark-sampler"
USER_AGENT = {'User-Agent': 'spark-analyzer'}

GL_NATIVE = 'gl-native'
NON_MOD_BUCKETS = (GL_NATIVE, 'jvm', 'unknown')
ENGINE_PREFIXES = ('org.lwjgl', 'com.mojang.blaze3d', 'java.', 'jdk.', 'sun.', 'it.unimi')
HOOK_RE = re.compile(r'^(?:wrapMethod|wrapOperation|wrapWithCondition|handler|redirect|modify[A-Za-z]*|localvar)'
                     r'\$[a-z0-9]+\$([^$]+)\$([^$]+)')
FAST_PATH_RE = re.compile(r'defer|skip|cull|cache|batch|reuse|fast|optimi|once|ifchanged|same', re.I)
CHEAP_GL_CALLS = ('glBindFramebuffer', 'glUseProgram', 'glBindTexture', 'glViewport', 'glColorMask',
                  'glFenceSync', 'glDeleteSync')
SMALL_PRIMITIVE_RE = re.compile(r'sky|sun|moon|star|disc|blit|quad|fullscreen|clear', re.I)
INTEGRATED_GPU_CPU_RE = re.compile(r'\d{4,5}G\d\b|\d{4,5}[UY]\b|\bApple M\d', re.I)
OLD_GEN_RE = re.compile(r'old|marksweep|major', re.I)
LIBRARY_RE = re.compile(r'^(?:[a-z0-9]+_){2,}|^fabric-.+-v\d+$|^(?:java|minecraft|fabricloader|mixinextras)$')
CLIENT_THREADS = ("Render thread", "Client thread")
PASS_ANCHORS = ('Minecraft.renderFrame', 'GameRenderer.render', 'GameRenderer.renderLevel', 'LevelRenderer.render',
                'FrameGraphBuilder.execute', 'GameRenderer.extract', 'Gui.extractRenderState', 'GuiRenderer.render',
                'GpuSurface.present', 'Minecraft.tick')
PASS_NAME_RE = re.compile(r'lambda\$add(\w+?)Pass')

SAMPLER_METADATA = {'start_time': 2, 'interval_us': 3, 'platform_metadata': 7, 'platform_statistics': 8,
                    'system_statistics': 9, 'end_time': 11, 'sources': 13, 'sampler_mode': 15,
                    'sampler_engine': 16}
SYSTEM_STATISTICS = {'cpu_threads': (1, 1), 'cpu_process_last1m': (1, 2, 1), 'cpu_model': (1, 4),
                     'ram_used': (2, 1, 1), 'ram_total': (2, 1, 2), 'gc_since_jvm_start': 3,
                     'java_version': (6, 2), 'java_vm_args': (6, 4), 'uptime_ms': (7,)}
PLATFORM_HEAP = {'path': (1, 1), 'used': 1, 'committed': 2, 'max': 4}
PLUGIN_OR_MOD_VERSION = 2

# ---------- minimal protobuf wire reader ----------
# Field numbers used below come from spark's official schema in references/*.proto.
def _rv(b, i):
    r = s = 0
    while True:
        x = b[i]; i += 1
        r |= (x & 0x7f) << s
        if not x & 0x80:
            return r, i
        s += 7

def parse(b):
    """Return {field_number: [(wiretype, value)]}. Values: v=int, d/f=raw bytes, b=bytes."""
    f = collections.defaultdict(list)
    i = 0
    while i < len(b):
        tag, i = _rv(b, i); fn = tag >> 3; wt = tag & 7
        if wt == 0:
            v, i = _rv(b, i); f[fn].append(('v', v))
        elif wt == 1:
            f[fn].append(('d', b[i:i+8])); i += 8
        elif wt == 2:
            ln, i = _rv(b, i); f[fn].append(('b', b[i:i+ln])); i += ln
        elif wt == 5:
            f[fn].append(('f', b[i:i+4])); i += 4
        else:
            raise ValueError("bad wiretype %d @ %d" % (wt, i))
    return f

# proto3 omits default values, so a missing scalar means 0 / "" and these return None.
def pstr(f, k):
    return f[k][0][1].decode('utf8', 'replace') if k in f else None

def pint(f, k):
    return f[k][0][1] if k in f else None

def pdbl(f, k):
    return struct.unpack('<d', f[k][0][1])[0] if k in f else None

def pmsg(f, k):
    return parse(f[k][0][1]) if k in f else {}

def ppath(f, path, getter):
    for k in path[:-1]:
        f = pmsg(f, k)
    return getter(f, path[-1])

def doubles(f, k):
    """repeated double, packed (proto3 default) or not."""
    out = []
    for wt, v in f.get(k, ()):
        out.extend(struct.unpack('<%dd' % (len(v) // 8), v) if wt == 'b' else struct.unpack('<d', v))
    return out

def varints(f, k):
    """repeated int32, packed (proto3 default) or not."""
    out = []
    for wt, v in f.get(k, ()):
        if wt == 'v':
            out.append(v); continue
        i = 0
        while i < len(v):
            x, i = _rv(v, i); out.append(x)
    return out

def pmap(f, k):
    """map<K, V> field -> {key: raw value}. String keys are decoded; values stay bytes/int."""
    out = {}
    for _, b in f.get(k, ()):
        e = parse(b)
        key = e[1][0][1] if 1 in e else ''
        out[key.decode('utf8', 'replace') if isinstance(key, bytes) else key] = e[2][0][1] if 2 in e else b''
    return out

def smap(f, k):
    return {key: v.decode('utf8', 'replace') for key, v in pmap(f, k).items()}

# ---------- fetch ----------
def _curl_path():
    if os.name == 'nt':
        system_curl = os.path.join(os.environ.get('SystemRoot', r'C:\Windows'), 'System32', 'curl.exe')
        if os.path.exists(system_curl):
            return system_curl
    return shutil.which('curl')

def fetch(ident):
    req = urllib.request.Request(BYTEBIN + ident, headers=USER_AGENT)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.headers.get_content_type(), r.read()
    except urllib.error.URLError as e:
        if not isinstance(e.reason, ssl.SSLError):
            raise
        tls_error = e
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            print("note: Python's TLS store failed; downloaded with certifi", file=sys.stderr)
            return r.headers.get_content_type(), r.read()
    except ImportError:
        pass
    curl = _curl_path()
    if not curl:
        raise tls_error
    out = subprocess.run([curl, '-sSfL', '--max-time', '60', '-A', USER_AGENT['User-Agent'],
                          '-w', '\n%{content_type}', BYTEBIN + ident], capture_output=True, check=True).stdout
    body, _, ctype = out.rpartition(b'\n')
    print("note: Python's TLS store failed; downloaded with curl", file=sys.stderr)
    return ctype.decode('ascii', 'replace').split(';')[0].strip(), body

def load(src):
    """src may be a spark URL, a bare bytebin id, or a local file path."""
    if os.path.exists(src):
        data = open(src, 'rb').read()
    else:
        m = re.search(r'(?:spark\.lucko\.me|bytebin\.lucko\.me)/(\w+)', src)
        ident = m.group(1) if m else src.strip().strip('/')
        ctype, data = fetch(ident)
        if ctype != SAMPLER_MEDIA_TYPE:
            raise ValueError("%s is %s, not a sampler profile (heap dump / health report?)" % (ident, ctype))
    if data[:2] == b'\x1f\x8b':          # gzip magic, e.g. a locally saved compressed upload
        data = gzip.decompress(data)
    if data[:1] != b'\x0a':
        # SamplerData.metadata (field 1, length-delimited) is always serialized first
        raise ValueError("not a spark sampler protobuf, first byte=%#x" % (data[0] if data else 0))
    return data

# ---------- core ----------
def analyze(data):
    top = parse(data)                                 # SamplerData
    class_src = smap(top, 3)                          # class_sources:  "class" -> mod
    method_src = smap(top, 4)                         # method_sources: "class;method;desc" -> mod
    line_src = smap(top, 5)                           # line_sources:   "class;line" -> mod

    def mod_of(cls, meth, desc, line):
        # Same precedence as spark-viewer's SourcesMap. method/line sources are how a mixin merged
        # into a vanilla class gets credited to the injecting mod instead of `minecraft`.
        src = (desc and method_src.get('%s;%s;%s' % (cls, meth, desc))) \
            or (line and line_src.get('%s;%d' % (cls, line))) \
            or class_src.get(cls)
        if src: return src
        if cls.startswith(('net.minecraft', 'com.mojang')): return 'minecraft'
        if cls.startswith('org.lwjgl'): return GL_NATIVE
        if cls.split('.')[0] in ('java', 'jdk', 'sun'): return 'jvm'
        return 'unknown'

    threads = {}   # name -> {by_mod, by_method, self_total, wall, ...}
    for _, tb in top.get(2, ()):                      # threads
        tn = parse(tb)                                # ThreadNode
        nodes = [parse(b) for _, b in tn.get(3, ())]  # children: every StackTraceNode, flattened
        if not nodes:
            continue
        totals = [sum(doubles(n, 8)) for n in nodes]  # times: inclusive time per window
        kids = [varints(n, 9) for n in nodes]         # children_refs: indices into `nodes`
        cls = [pstr(n, 3) or '' for n in nodes]       # class_name
        meth = [pstr(n, 4) or '' for n in nodes]      # method_name
        mods = [mod_of(cls[i], meth[i], pstr(n, 7), pint(n, 6)) for i, n in enumerate(nodes)]   # method_desc, line_number
        selft = [totals[i] - sum(totals[k] for k in kids[i]) for i in range(len(nodes))]
        by_mod = collections.Counter(); by_meth = collections.Counter(); tot = 0.0
        for i in range(len(nodes)):
            if selft[i] <= 0:
                continue
            by_mod[mods[i]] += selft[i]
            by_meth['%s.%s [%s]' % (cls[i].split('.')[-1] or '?', meth[i], mods[i])] += selft[i]
            tot += selft[i]
        threads[pstr(tn, 1)] = {                      # name
            'by_mod': by_mod, 'by_method': by_meth, 'self_total': tot,
            # ThreadNode.times is the thread's wall time: the only correct self-time % denominator.
            'wall': sum(doubles(tn, 4)) or tot,
            # Kept so callers can walk the tree (inclusive time of a subtree, "who calls X").
            'totals': totals, 'kids': kids, 'cls': cls, 'meth': meth, 'mods': mods, 'selft': selft,
            'class_mods': [class_src.get(c) for c in cls],
            'parent': {k: i for i, ks in enumerate(kids) for k in ks},
            'hooks': [hook_key(m) for m in meth],
        }

    return {
        'threads': threads,
        'windows': len(varints(top, 6)),              # time_windows
        'meta': metadata(top),
        'mods': modset(top),
        'mod_versions': mod_versions(top),
    }

def modset(top):
    # SamplerMetadata.sources is the full loaded mod/plugin list; fall back to mods seen in samples.
    return set(pmap(pmsg(top, 1), 13)) or {m for k in (3, 4, 5) for m in smap(top, k).values()}

def mod_versions(top):
    return {name: pstr(parse(raw), PLUGIN_OR_MOD_VERSION) or ''
            for name, raw in pmap(pmsg(top, 1), SAMPLER_METADATA['sources']).items()}

def metadata(top):
    m = pmsg(top, 1)                                  # SamplerMetadata
    p = pmsg(m, 7)                                    # platform_metadata
    s = pmsg(m, 8)                                    # platform_statistics
    tps = pmsg(s, 4)                                  # PlatformStatistics.tps
    mspt = pmsg(pmsg(s, 5), 1)                        # PlatformStatistics.mspt.last1m
    out = {
        'loader': pstr(p, 2), 'loader_version': pstr(p, 3), 'mc_version': pstr(p, 4),
        'mode': 'allocation' if pint(m, 15) == 1 else 'execution',  # sampler_mode
        'engine': 'async' if pint(m, SAMPLER_METADATA['sampler_engine']) == 1 else 'java',
        'interval_ms': (pint(m, SAMPLER_METADATA['interval_us']) or 0) / 1000.0,
        'tps': pdbl(tps, 1),                          # last1m
        'mspt_mean': pdbl(mspt, 1), 'mspt_max': pdbl(mspt, 2),
        'entities': pint(pmsg(s, 8), 1),              # world.total_entities
        'gc': {},
        'system': system_stats(m),
    }
    start, end = pint(m, 2), pint(m, 11)              # start_time, end_time (epoch ms)
    if start and end:
        out['duration_ms'] = end - start
    # PlatformStatistics.gc in a sampler is the delta since the profile started.
    for name, b in pmap(s, 2).items():
        g = parse(b)
        if pint(g, 1):                                # total (collection count)
            out['gc'][name] = {'count': pint(g, 1), 'avg_ms': pdbl(g, 2) or 0.0}
    return out

def system_stats(m):
    s = pmsg(m, SAMPLER_METADATA['system_statistics'])
    f = SYSTEM_STATISTICS
    heap = ppath(pmsg(m, SAMPLER_METADATA['platform_statistics']), PLATFORM_HEAP['path'], pmsg)
    vm_args = ppath(s, f['java_vm_args'], pstr) or ''
    xmx = re.search(r'-Xmx(\S+)', vm_args)
    gc = {}
    for name, raw in pmap(s, f['gc_since_jvm_start']).items():
        g = parse(raw)
        if pint(g, 1):
            gc[name] = {'count': pint(g, 1), 'avg_ms': pdbl(g, 2) or 0.0}
    out = {
        'cpu_model': (ppath(s, f['cpu_model'], pstr) or '').strip() or None,
        'cpu_threads': ppath(s, f['cpu_threads'], pint),
        'cpu_process_last1m': ppath(s, f['cpu_process_last1m'], pdbl),
        'ram_used': ppath(s, f['ram_used'], pint), 'ram_total': ppath(s, f['ram_total'], pint),
        'heap_used': pint(heap, PLATFORM_HEAP['used']), 'heap_committed': pint(heap, PLATFORM_HEAP['committed']),
        'heap_max': pint(heap, PLATFORM_HEAP['max']),
        'java_version': ppath(s, f['java_version'], pstr), 'xmx': xmx.group(1) if xmx else None,
        'uptime_ms': ppath(s, f['uptime_ms'], pint), 'gc_since_jvm_start': gc,
    }
    out['hints'] = system_hints(out)
    return out

def system_hints(s):
    hints = []
    if s['cpu_model'] and INTEGRATED_GPU_CPU_RE.search(s['cpu_model']):
        hints.append('mobile-class CPU, so the GPU is likely integrated: expect fill-rate/overdraw sensitivity '
                     '(inference, spark records no GPU)')
    if s['ram_used'] and s['ram_total'] and s['ram_used'] / s['ram_total'] >= 0.85:
        hints.append('physical RAM %.0f%% used' % (100.0 * s['ram_used'] / s['ram_total']))
    old = {n: g for n, g in s['gc_since_jvm_start'].items() if OLD_GEN_RE.search(n)}
    for name, g in old.items():
        hints.append('%s ran %dx since JVM start (avg %.0f ms): possible stutter source' % (name, g['count'], g['avg_ms']))
    return hints

def hook_key(method):
    m = HOOK_RE.match(method)
    return (m.group(1), m.group(2)) if m else None

def short(t, i):
    return '%s.%s' % (t['cls'][i].split('.')[-1] or '?', t['meth'][i])

def owns_class(t, i, mod):
    if t['class_mods'][i]:
        return t['class_mods'][i] == mod
    return ('.%s.' % mod.replace('-', '').replace('_', '')).lower() in ('.' + t['cls'][i]).lower()

def is_glue(t, i):
    return '$$Lambda' in t['cls'][i] or 'mixinextras$bridge' in t['meth'][i]

def is_engine(t, i):
    return t['cls'][i].startswith(ENGINE_PREFIXES) or is_glue(t, i)

def caller_chain(t, i, depth, skip_hooks=False):
    out = []
    p = t['parent'].get(i)
    while p is not None and len(out) < depth:
        if not is_engine(t, p):
            hook = t['hooks'][p]
            if hook and not skip_hooks:
                out.append('[%s$%s]' % hook)
            elif not hook:
                out.append(short(t, p))
        p = t['parent'].get(p)
    return ' <- '.join(out) or '(root)'

def outermost(t, i, key):
    p = t['parent'].get(i)
    while p is not None:
        if key(p):
            return False
        p = t['parent'].get(p)
    return True

def top_instances(t, match):
    hits = set(i for i in range(len(t['totals'])) if match(i))
    tops = []
    for i in hits:
        p = t['parent'].get(i)
        while p is not None and p not in hits:
            p = t['parent'].get(p)
        if p is None:
            tops.append(i)
    return tops

def subtree(t, root):
    stack = [root]
    while stack:
        n = stack.pop()
        yield n
        stack.extend(t['kids'][n])

def pct(t, ms):
    return 100.0 * ms / t['wall'] if t['wall'] else 0.0

def pass_name(t, root):
    queue = collections.deque([root]); seen = 0
    while queue and seen < 4000:
        n = queue.popleft(); seen += 1
        m = PASS_NAME_RE.search(t['meth'][n])
        if m:
            return m.group(1)
        queue.extend(t['kids'][n])
    return re.sub(r'\$\$Lambda.*$', '', t['cls'][root].split('.')[-1]) or short(t, root)

def owner_costs(t, root):
    costs = collections.Counter(); native = 0.0
    stack = [(root, t['mods'][root])]
    while stack:
        n, owner = stack.pop()
        hook = t['hooks'][n]
        if hook:
            owner = hook[0]
        elif 'mixinextras$wrapped' in t['meth'][n] or 'mixinextras$bridge' in t['meth'][n]:
            owner = 'minecraft' if t['cls'][n].startswith(('net.minecraft', 'com.mojang')) else t['mods'][n]
        elif not is_engine(t, n) and t['mods'][n] not in NON_MOD_BUCKETS:
            owner = t['mods'][n]
        if t['selft'][n] > 0:
            costs[owner] += t['selft'][n]
            if t['mods'][n] == GL_NATIVE:
                native += t['selft'][n]
        stack.extend((k, owner) for k in t['kids'][n])
    return costs, native

def hooks_in(t, root, min_ms):
    found = collections.Counter()
    for n in subtree(t, root):
        hook = t['hooks'][n]
        if hook and t['totals'][n] >= min_ms and outermost(t, n, lambda p: t['hooks'][p] == hook):
            found['%s$%s' % hook] += t['totals'][n]
    return found

def render_passes(t):
    anchors = []
    for name in PASS_ANCHORS:
        tops = top_instances(t, lambda i: short(t, i) == name)
        if tops:
            anchors.append({'frame': name, 'pct': pct(t, sum(t['totals'][i] for i in tops))})
    passes = collections.OrderedDict()
    for fg in top_instances(t, lambda i: short(t, i) == 'FrameGraphBuilder.execute'):
        for k in t['kids'][fg]:
            if pct(t, t['totals'][k]) < 0.5:
                continue
            name = pass_name(t, k)
            costs, native = owner_costs(t, k)
            entry = passes.setdefault(name, {'name': name, 'ms': 0.0, 'native_ms': 0.0,
                                             'owners': collections.Counter(), 'hooks': collections.Counter()})
            entry['ms'] += t['totals'][k]; entry['native_ms'] += native
            entry['owners'].update(costs)
            entry['hooks'].update(hooks_in(t, k, 0.005 * t['wall']))
    out = []
    for p in sorted(passes.values(), key=lambda p: -p['ms']):
        out.append({'name': p['name'], 'pct': pct(t, p['ms']), 'gl_native_pct': pct(t, p['native_ms']),
                    'owners': [(m, pct(t, ms)) for m, ms in p['owners'].most_common(6) if pct(t, ms) >= 0.1],
                    'hooks': [(h, pct(t, ms)) for h, ms in p['hooks'].most_common(5)]})
    return {'anchors': anchors, 'passes': out}

def audit_hooks(t, min_pct):
    tops = collections.defaultdict(list)
    for i, hook in enumerate(t['hooks']):
        if hook and outermost(t, i, lambda p: t['hooks'][p] == hook):
            tops[hook].append(i)
    rows = []
    for hook, nodes in tops.items():
        incl = sum(t['totals'][i] for i in nodes)
        if pct(t, incl) < min_pct:
            continue
        mod = hook[0]; original = 0.0; own = 0.0
        for root in nodes:
            stack = [(k, False) for k in t['kids'][root]]
            while stack:
                n, bridged = stack.pop()
                if t['hooks'][n] == hook or is_glue(t, n):
                    stack.extend((k, bridged or 'mixinextras$bridge' in t['meth'][n]) for k in t['kids'][n])
                    continue
                if bridged or 'mixinextras$wrapped' in t['meth'][n]:
                    original += t['totals'][n]
                own += own_time(t, n, mod)
        ratio = original / incl if incl else 0.0
        own_share = own / incl if incl else 0.0
        flagged = ratio >= 0.95 and own_share < 0.2 and FAST_PATH_RE.search(hook[1])
        rows.append({'hook': '%s$%s' % hook, 'mod': mod, 'on': t['cls'][nodes[0]].split('.')[-1],
                     'pct': pct(t, incl), 'pass_through': ratio, 'own_share': own_share,
                     'flag': 'PASS-THROUGH' if flagged else None})
    rows.sort(key=lambda r: (r['flag'] is None, -r['pct']))
    return rows

def own_time(t, root, mod):
    total = 0.0
    stack = [root]
    while stack:
        n = stack.pop()
        hook = t['hooks'][n]
        if (hook and hook[0] == mod) or owns_class(t, n, mod):
            total += t['totals'][n]
        else:
            stack.extend(t['kids'][n])
    return total

def gl_anomalies(t):
    found = collections.Counter(); kinds = {}
    for i in range(len(t['totals'])):
        if t['mods'][i] != GL_NATIVE or t['selft'][i] <= 0:
            continue
        call = t['meth'][i]
        if call.startswith(CHEAP_GL_CALLS) and pct(t, t['selft'][i]) >= 0.25:
            key = (short(t, i), caller_chain(t, i, 2, skip_hooks=True))
            found[key] += t['selft'][i]; kinds[key] = 'cheap call'
        elif 'Draw' in call and pct(t, t['selft'][i]) >= 1.0:
            caller = caller_chain(t, i, 1, skip_hooks=True)
            if SMALL_PRIMITIVE_RE.search(caller):
                key = (short(t, i), caller)
                found[key] += t['selft'][i]; kinds[key] = 'small primitive'
    return [{'call': c, 'caller': who, 'kind': kinds[(c, who)], 'pct': pct(t, ms)}
            for (c, who), ms in found.most_common(8) if pct(t, ms) >= 0.5]

def callers(t, pattern, depth):
    out = []
    for pat in [p.strip() for p in pattern.split(',') if p.strip()]:
        agg = collections.Counter(); low = pat.lower()
        for i in range(len(t['totals'])):
            if t['selft'][i] > 0 and low in short(t, i).lower():
                agg[caller_chain(t, i, depth)] += t['selft'][i]
        out.append({'pattern': pat, 'pct': pct(t, sum(agg.values())),
                    'chains': [(c, pct(t, ms)) for c, ms in agg.most_common(8)]})
    return out

# ---------- report ----------
def gb(n):
    return '%.1f' % (n / 1e9) if n else '?'

def print_system(s):
    bits = []
    if s['cpu_model']:
        cpu = re.sub(r'\(R\)|\(TM\)|CPU|@.*$', '', s['cpu_model'])
        bits.append('%s (%s thr, proc %.0f%%)' % (' '.join(cpu.split()), s['cpu_threads'] or '?',
                                                  100 * (s['cpu_process_last1m'] or 0)))
    if s['ram_total']:
        bits.append('ram %s/%s GB (%.0f%%)' % (gb(s['ram_used']), gb(s['ram_total']),
                                              100.0 * (s['ram_used'] or 0) / s['ram_total']))
    if s['heap_max']:
        bits.append('heap %s/%s/%s GB' % (gb(s['heap_used']), gb(s['heap_committed']), gb(s['heap_max'])))
    if s['java_version']:
        bits.append('java %s' % s['java_version'])
    if s['uptime_ms']:
        bits.append('uptime %dm' % (s['uptime_ms'] // 60000))
    if bits:
        print("  system: " + "  ".join(bits))
    if s['gc_since_jvm_start']:
        print("  gc since jvm start: " + ", ".join(
            "%s %dx/%.0fms avg" % (n, g['count'], g['avg_ms']) for n, g in s['gc_since_jvm_start'].items()))
    for h in s['hints']:
        print("  hint: " + h)

def print_report(label, res, thread, top_n, show_all, hook_min):
    meta = res['meta']
    hdr = "%s  [%s %s / MC %s]" % (label, meta.get('loader', '?'),
                                   meta.get('loader_version', ''), meta.get('mc_version', '?'))
    print("\n" + "=" * len(hdr)); print(hdr); print("=" * len(hdr))
    bits = []
    if meta.get('duration_ms'): bits.append("dur=%.0fs" % (meta['duration_ms'] / 1000))
    bits.append("windows=%d" % res['windows'])
    bits.append("engine=%s/%gms" % (meta['engine'], meta['interval_ms']))
    if meta.get('tps') is not None: bits.append("tps1m=%.1f" % meta['tps'])
    if meta.get('mspt_mean') is not None:
        bits.append("mspt1m=%.2f/%.0fmax" % (meta['mspt_mean'], meta.get('mspt_max') or 0))
    if meta.get('entities') is not None: bits.append("entities=%d" % meta['entities'])
    bits.append("mods=%d" % len(res['mods']))
    print("  " + "  ".join(bits))
    print_system(meta['system'])
    if meta['gc']:
        print("  gc during capture: " + ", ".join(
            "%s %dx/%.0fms" % (n, g['count'], g['count'] * g['avg_ms']) for n, g in meta['gc'].items()))
    if meta['mode'] == 'allocation':
        print("  ALLOCATION profile: every 'ms' figure below is actually bytes allocated")

    t = res['threads'].get(thread)
    if not t:
        print("  (thread %r not found; busiest: %s)" % (thread, busiest_threads(res))); return
    tot = t['wall']
    print("\n  %s - self-time by mod (%% of thread, %.1fs sampled)" % (thread, tot / 1000))
    for mod, ms in t['by_mod'].most_common(top_n):
        print("    %6.2f%%  %9.0f  %s" % (100 * ms / tot, ms, mod))
    print("\n  %s - top methods" % thread)
    for k, ms in t['by_method'].most_common(min(top_n, 20)):
        print("    %6.2f%%  %s" % (100 * ms / tot, k))

    if thread in CLIENT_THREADS:
        print_passes(render_passes(t))
    print_hooks(audit_hooks(t, hook_min), hook_min, top_n)
    print_anomalies(gl_anomalies(t))

    if show_all:
        allm = collections.Counter(); atot = 0.0
        for th in res['threads'].values():
            allm.update(th['by_mod']); atot += th['wall']
        print("\n  ALL THREADS - self-time by mod (mostly idle/GC/background)")
        for mod, ms in allm.most_common(top_n):
            print("    %6.2f%%  %9.0f  %s" % (100 * ms / atot, ms, mod))

def print_passes(p):
    if not p['anchors']:
        return
    print("\n  frame breakdown (inclusive % of thread)")
    print("    " + "  ".join("%s %.1f" % (a['frame'], a['pct']) for a in p['anchors']))
    if not p['passes']:
        return
    print("  render passes (cost by owner, GL natives charged to the caller)")
    for x in p['passes']:
        owners = ", ".join("%s %.2f" % o for o in x['owners'])
        hooks = ", ".join("%s %.1f" % h for h in x['hooks'])
        print("    %-12s %6.2f%%  gl-native %.1f  [%s]%s" % (x['name'], x['pct'], x['gl_native_pct'], owners,
                                                         ("  hooks: " + hooks) if hooks else ""))

def print_hooks(rows, hook_min, top_n):
    if not rows:
        return
    print("\n  hook audit (mixin hooks >= %g%%; pass = share of time in the original method, own = in the mod's"
          " other code)" % hook_min)
    print("       incl   pass   own  hook")
    for r in rows[:min(top_n, 15)]:
        print("    %6.2f%%  %4.0f%%  %3.0f%%  %s (%s)%s" % (r['pct'], 100 * r['pass_through'], 100 * r['own_share'],
                                                    r['hook'], r['on'], "  " + r['flag'] if r['flag'] else ""))
    if any(r['flag'] for r in rows):
        print("    PASS-THROUGH = a fast-path hook ran straight into the original with little of its mod's code below")
        print("    it. Its fast path may be gated off: read the mod's source for bail-out conditions. A lead, not proof.")

def print_anomalies(rows):
    if not rows:
        return
    print("\n  suspicious GL calls (a stall lands here: the GPU work before or around it is heavy)")
    for r in rows:
        print("    %6.2f%%  %s  <- %s  (%s)" % (r['pct'], r['call'], r['caller'], r['kind']))

def print_tree(label, res, thread, pattern, min_pct, max_depth):
    """Inclusive-time call tree under every frame matching `pattern` (substring of Class.method).

    Self-time answers "which mod burns CPU"; this answers "what is that mod doing", which is the
    part you can act on. A mod whose cost is entirely in Skia/JVM/native frames has ~0 self-time
    under its own name and is invisible in the by-mod table.
    """
    t = res['threads'].get(thread)
    if not t:
        return
    totals, kids, wall, cls, meth, selft = t['totals'], t['kids'], t['wall'], t['cls'], t['meth'], t['selft']

    def fq(i):
        return "%s.%s" % (cls[i] or '?', meth[i])

    pat = pattern.lower()
    tops = top_instances(t, lambda i: pat in fq(i).lower())
    if not tops:
        print("\n  (no frame matching %r in %s)" % (pattern, thread))
        return

    print("\n  %s - %r subtree (inclusive %% of thread)" % (label, pattern))

    def walk(i, depth):
        pct_i = 100.0 * totals[i] / wall
        if pct_i < min_pct or depth > max_depth:
            return
        print("    %s%6.2f%% %7.0fms  %s  [self %.2f%%]"
              % ("  " * depth, pct_i, totals[i], fq(i), 100.0 * selft[i] / wall))
        for k in sorted(kids[i], key=lambda x: -totals[x]):
            walk(k, depth + 1)

    for i in sorted(tops, key=lambda x: -totals[x]):
        walk(i, 0)

def print_callers(label, res, thread, pattern, depth):
    t = res['threads'].get(thread)
    if not t:
        return
    for c in callers(t, pattern, depth):
        print("\n  %s - callers of %r (%.2f%% self)" % (label, c['pattern'], c['pct']))
        for chain, p in c['chains']:
            print("    %6.2f%%  %s" % (p, chain))
        if not c['chains']:
            print("    (no frame matching %r)" % c['pattern'])

def print_mods(label, res):
    versions = res['mod_versions']
    names = sorted(versions) if versions else sorted(res['mods'])
    print("\n  %s - loaded mods (%d)" % (label, len(names)))
    print("    " + ", ".join(("%s %s" % (n, versions.get(n, ''))).strip() for n in names))

def mod_list(names, limit=40):
    mods = sorted(n for n in names if not LIBRARY_RE.match(n))
    libs = len(names) - len(mods)
    text = ", ".join(mods[:limit]) or "(none)"
    if len(mods) > limit:
        text += ", ... %d more" % (len(mods) - limit)
    return text + ("  (+%d libraries)" % libs if libs else "")

def print_diff(labels, results, thread):
    print("\n" + "#" * 60); print("# COMPARISON"); print("#" * 60)
    # mod-set diff (pairwise vs first)
    base = results[0]['mods']
    for lab, r in zip(labels[1:], results[1:]):
        print("\nmod-set: %s vs %s" % (lab, labels[0]))
        print("  added:   " + mod_list(r['mods'] - base))
        print("  removed: " + mod_list(base - r['mods']))
    # side-by-side render-thread self% for the union of top mods
    print("\n%s self-time %% (side by side):" % thread)
    union = set()
    for r in results:
        th = r['threads'].get(thread)
        if th:
            union.update(m for m, _ in th['by_mod'].most_common(15))
    rows = []
    for mod in union:
        pcts = []
        for r in results:
            th = r['threads'].get(thread)
            if th and th['wall']:
                pcts.append(100 * th['by_mod'].get(mod, 0) / th['wall'])
            else:
                pcts.append(0.0)
        rows.append((max(pcts), mod, pcts))
    rows.sort(reverse=True)
    print("  %-32s %s" % ("mod", "  ".join("%9s" % l[:9] for l in labels)))
    for _, mod, pcts in rows:
        print("  %-32s %s" % (mod, "  ".join("%8.2f%%" % p for p in pcts)))

def busiest_threads(res, limit=15):
    names = sorted(res['threads'], key=lambda n: -res['threads'][n]['wall'])
    return ", ".join(names[:limit]) + (", ..." if len(names) > limit else "")

def pick_thread(res, thread):
    if thread:
        return thread
    for name in CLIENT_THREADS:
        if name in res['threads']:
            return name
    return None

def to_json(lab, r, thread, hook_min, tree, callers_pattern, callers_depth):
    th = r['threads'].get(thread) or {}
    out = {'label': lab, 'meta': r['meta'], 'windows': r['windows'], 'mods': sorted(r['mods']),
           'thread': thread, 'self_total_ms': th.get('self_total'), 'wall_ms': th.get('wall'),
           'by_mod': dict((th.get('by_mod') or collections.Counter()).most_common())}
    if th:
        out['passes'] = render_passes(th) if thread in CLIENT_THREADS else None
        out['hooks'] = audit_hooks(th, hook_min)
        out['anomalies'] = gl_anomalies(th)
        if callers_pattern:
            out['callers'] = callers(th, callers_pattern, callers_depth)
    return out

def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(errors='replace')
    args = sys.argv[1:]
    thread = None; top_n = 25; show_all = False; as_json = False; show_mods = False
    tree = None; tree_min = 0.15; tree_depth = 20
    callers_pattern = None; callers_depth = 4; hook_min = 1.0
    srcs = []
    i = 0
    try:
        while i < len(args):
            a = args[i]
            if a == '--thread': thread = args[i+1]; i += 2
            elif a == '--top': top_n = int(args[i+1]); i += 2
            elif a == '--tree': tree = args[i+1]; i += 2
            elif a == '--tree-min': tree_min = float(args[i+1]); i += 2
            elif a == '--tree-depth': tree_depth = int(args[i+1]); i += 2
            elif a == '--callers': callers_pattern = args[i+1]; i += 2
            elif a == '--callers-depth': callers_depth = int(args[i+1]); i += 2
            elif a == '--hook-min': hook_min = float(args[i+1]); i += 2
            elif a == '--mods': show_mods = True; i += 1
            elif a == '--all': show_all = True; i += 1
            elif a == '--json': as_json = True; i += 1
            elif a.startswith('--'): raise ValueError('unknown option %s' % a)
            else: srcs.append(a); i += 1
    except IndexError:
        print('ERROR: missing value for %s' % args[i]); sys.exit(1)
    except ValueError as e:
        print('ERROR: %s' % e); sys.exit(1)
    if not srcs:
        print(__doc__); sys.exit(1)

    labels, results = [], []
    for s in srcs:
        # For a local file the bytebin-id regex would label everything "bin"; use the stem.
        lab = os.path.splitext(os.path.basename(s))[0] if os.path.exists(s) \
            else re.search(r'(\w+)$', s.rstrip('/')).group(1)
        labels.append(lab)
        results.append(analyze(load(s)))

    if as_json:
        print(json.dumps([to_json(lab, r, pick_thread(r, thread), hook_min, tree, callers_pattern, callers_depth)
                          for lab, r in zip(labels, results)], indent=2, default=list)); return

    focus = None
    for lab, r in zip(labels, results):
        focus = pick_thread(r, thread)
        if not focus:
            print('ERROR: no "Render thread" or "Client thread"; pass --thread. Busiest: %s' % busiest_threads(r))
            sys.exit(1)
        print_report(lab, r, focus, top_n, show_all, hook_min)
        if tree:
            print_tree(lab, r, focus, tree, tree_min, tree_depth)
        if callers_pattern:
            print_callers(lab, r, focus, callers_pattern, callers_depth)
        if show_mods:
            print_mods(lab, r)
    if len(results) > 1:
        print_diff(labels, results, focus)

if __name__ == '__main__':
    main()
