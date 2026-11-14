#!/opt/homebrew/bin/python3
"""Build manifest.json and statics.tsv from the per-hash rows written by `screen3.mjs range`.

usage: build_manifest.py <out_dir_with_w*.tsv.gz> <dest_dir> <screen3.mjs> <intervals.js>
"""
import gzip, hashlib, json, sys, glob, os, re

CHUNK = 100_000
VT = ['none', 'analogous', 'complementary', 'monochromatic', 'achromatic', 'saturated', 'tinted']
CORE = (0, 1, 2, 3, 4, 5, 6, 14)  # i, bars, o, lt, vt, ratio, restarts, nflat


def hash_at(i):
    return '0x' + hashlib.sha256(('intervals-r3:%d' % i).encode()).hexdigest()


def sha_file(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def rows(out_dir):
    files = sorted(glob.glob(os.path.join(out_dir, 'w*.tsv.gz')), key=lambda p: int(re.search(r'w(\d+)\.tsv', p).group(1)))
    for f in files:
        with gzip.open(f, 'rt') as fh:
            next(fh)
            for line in fh:
                yield line.rstrip('\n')


def new_chunk(start):
    return {'start': start, 'full': hashlib.sha256(), 'core': hashlib.sha256(), 'variants': [0] * 7, 'statics': [0] * 7}


def close_chunk(c):
    return {'start': c['start'], 'end': c['start'] + CHUNK, 'full': c['full'].hexdigest(), 'core': c['core'].hexdigest(),
            'variants': dict(zip(VT, c['variants'])), 'statics': dict(zip(VT, c['statics']))}


def main():
    out_dir, dest, script, art = sys.argv[1:5]
    chunks, statics, cur, expect = [], [], None, 0
    for line in rows(out_dir):
        f = line.split('\t')
        i = int(f[0])
        if i != expect:
            sys.exit('index gap: expected %d, got %d' % (expect, i))
        expect += 1
        if i % CHUNK == 0:
            if cur:
                chunks.append(close_chunk(cur))
            cur = new_chunk(i)
        cur['full'].update((line + '\n').encode())
        cur['core'].update(('\t'.join(f[k] for k in CORE) + '\n').encode())
        vt = int(f[4])
        cur['variants'][vt] += 1
        if f[14] == '3':
            cur['statics'][vt] += 1
            statics.append((i, hash_at(i), VT[vt], f[1], 'vertical' if f[2] == '0' else 'horizontal', 'varied' if f[3] == '1' else 'even', f[5]))
    chunks.append(close_chunk(cur))
    totals = {'hashes': expect,
              'variants': {v: sum(c['variants'][v] for c in chunks) for v in VT},
              'statics': {v: sum(c['statics'][v] for c in chunks) for v in VT}}
    totals['statics_all'] = sum(totals['statics'].values())
    manifest = {
        'sequence': 'hash(i) = "0x" + hex(sha256("intervals-r3:" + i)), i as a decimal integer',
        'range': [0, expect], 'chunk_size': CHUNK,
        'static_definition': 'nflat == 3: each of the three colour intervals spans less than 2 CIELAB units from its start colour to its end colour',
        'core_columns': ['i', 'bars', 'o', 'lt', 'vt', 'ratio', 'restarts', 'nflat'],
        'variant_codes': VT,
        'node_version_used': 'v26.13.1',
        'sha256': {'screen3.mjs': sha_file(script), 'intervals.js': sha_file(art)},
        'totals': totals, 'chunks': chunks,
    }
    json.dump(manifest, open(os.path.join(dest, 'manifest.json'), 'w'), indent=1)
    with open(os.path.join(dest, 'statics.tsv'), 'w') as fh:
        fh.write('index\thash\tvariant\tbars\torientation\twidths\tratio\n')
        for s in statics:
            fh.write('\t'.join(map(str, s)) + '\n')
    print(json.dumps(totals))


main()
