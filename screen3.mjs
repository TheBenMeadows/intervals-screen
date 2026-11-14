// Browser-free screen of Intervals' setup(). Runs the unmodified intervals.js inside a Node vm
// context with a minimal p5 1.9.0 shim (only the colour + math calls setup() uses, copied from
// p5.min.js semantics) and swaps the Random class for the same sfc32 written as a tight loop.
//
// usage:
//   node screen3.mjs list <hashes.txt> <out.jsonl>        full rows (round-2 format) for validation
//   node screen3.mjs range <start> <end> <outprefix>      deterministic hashes sha256("intervals-r3:"+i)
//        writes <outprefix>.tsv.gz (one summary row per hash), <outprefix>.rare.jsonl (full rows of rare hits)
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = fs.readFileSync(process.env.INTERVALS_JS || path.join(HERE, 'intervals.js'), 'utf8');

// ---- p5 shim -------------------------------------------------------------
const RGB = 'rgb', HSB = 'hsb';
const MAXES = { rgb: [255, 255, 255, 255], hsb: [360, 100, 100, 1] };
let colorModeNow = RGB;
function hsbaToRGBA(e) {
  let t, r, o, n, s, i = 6 * e[0], a = e[1], l = e[2];
  if (a === 0) return [l, l, l, e[3]];
  r = l * (1 - a); t = Math.floor(i); o = l * (1 - a * (i - t)); a = l * (1 - a * (1 + t - i));
  if (t === 1) { n = o; s = l; i = r; } else if (t === 2) { n = r; s = l; i = a; } else if (t === 3) { n = r; s = o; i = l; }
  else if (t === 4) { n = a; s = r; i = l; } else if (t === 5) { n = l; s = r; i = o; } else { n = l; s = a; i = r; }
  return [n, s, i, e[3]];
}
class Color {
  constructor(args) {
    const a = MAXES[colorModeNow];
    const l = [args[0] / a[0], args[1] / a[1], args[2] / a[2], typeof args[3] === 'number' ? args[3] / a[3] : 1];
    for (let n = l.length - 1; n >= 0; --n) { const u = l[n]; if (u < 0) l[n] = 0; else if (u > 1) l[n] = 1; }
    this._array = colorModeNow === HSB ? hsbaToRGBA(l) : l;
  }
}
const p5min = (...args) => { const arr = Array.isArray(args[0]) ? args[0] : args; let t = Infinity; for (const a of arr) t = a < t ? a : t; return t; };
const p5max = (...args) => { const arr = Array.isArray(args[0]) ? args[0] : args; let t = -Infinity; for (const a of arr) t = t < a ? a : t; return t; };
const shim = {
  RGB, HSB, PI: Math.PI,
  windowWidth: 850, windowHeight: 700,
  createCanvas() {}, noStroke() {}, noFill() {},
  colorMode(m) { colorModeNow = m; },
  color(...args) { if (args[0] instanceof Color) return args[0]; return new Color(Array.isArray(args[0]) ? args[0] : args); },
  red: (c) => c._array[0] * 255, green: (c) => c._array[1] * 255, blue: (c) => c._array[2] * 255,
  degrees: (x) => x * (180 / Math.PI), radians: (x) => x * (Math.PI / 180),
  atan2: (y, x) => Math.atan2(y, x), cos: (x) => Math.cos(x), sin: (x) => Math.sin(x),
  dist: (...t) => (t.length === 4 ? Math.hypot(t[2] - t[0], t[3] - t[1]) : Math.hypot(t[3] - t[0], t[4] - t[1], t[5] - t[2])),
  abs: Math.abs, sqrt: Math.sqrt, sq: (x) => x * x, pow: Math.pow, floor: Math.floor,
  round: (e, t) => (t ? ((t = Math.pow(10, t)), Math.round(e * t) / t) : Math.round(e)),
  min: p5min, max: p5max,
  console,
};
const ctx = vm.createContext(shim);
ctx.window = ctx;
vm.runInContext(SRC, ctx, { filename: 'intervals.js' });

// Fast sfc32: same state update and the same 500,000 warm-up steps per stream as Random's constructor.
ctx.__mk = (hx) => {
  let a = parseInt(hx.substr(0, 8), 16) | 0, b = parseInt(hx.substr(8, 8), 16) | 0;
  let cc = parseInt(hx.substr(16, 8), 16) | 0, d = parseInt(hx.substr(24, 8), 16) | 0;
  for (let i = 0; i < 500000; i++) {
    const t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0; a = b ^ (b >>> 9);
    b = (cc + (cc << 3)) | 0; cc = (cc << 21) | (cc >>> 11); cc = (cc + t) | 0;
  }
  return function () {
    const t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0; a = b ^ (b >>> 9);
    b = (cc + (cc << 3)) | 0; cc = (cc << 21) | (cc >>> 11); cc = (cc + t) | 0;
    return (t >>> 0) / 4294967296;
  };
};
vm.runInContext(`
  if (!globalThis.__ORIG) {
    const Orig = Random;
    const Fast = function (hash) { this.useA = false; this.prngA = __mk(hash.substr(2, 32)); this.prngB = __mk(hash.substr(34, 32)); };
    Fast.prototype = Orig.prototype;
    if (!globalThis.__SLOW) Random = Fast;
    const g0 = gcolor, p0 = plain;
    globalThis.__st = {};
    globalThis.gcolor = function (j, pinned) {
      __st.calls++; if (j === 0) __st.j0++; if (pinned) __st.pins++;
      if (c.length >= 6 && c[j] !== undefined) __st.redraws++;
      return g0(j, pinned);
    };
    globalThis.plain = function () { const r = p0(); if (r) __st.plainTrue++; return r; };
    globalThis.__run = function (hash) {
      lmin = 5; dmin = 10; plot = false;
      __st = { calls: 0, j0: 0, pins: 0, redraws: 0, plainTrue: 0 };
      tokenData = { hash, tokenId: '6999999' };
      setup();
      return { s, o, ltype, vtype, bw, bx, an: vtype === 'analogous' ? [aspan, adir, aend] : null, st: { ...__st }, c, f: { ...$features }, lmin, dmin };
    };
    globalThis.__lab = rgbToLab; globalThis.__lerp = betterLerp;
    globalThis.__ORIG = true;
  }
`, ctx);

const hex2 = (c) => [shim.red(c), shim.green(c), shim.blue(c)].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Round-2 row format (screen2.mjs) for byte-level validation.
function fullRow(hash) {
  const r = ctx.__run(hash);
  const bars = [];
  for (let i = 0; i < r.s; i++) for (let j = 0; j < 3; j++) bars.push(hex2(ctx.__lerp(r.c[2 * j].col, r.c[2 * j + 1].col, i / (r.s - 1))));
  return {
    row: {
      hash, f: r.f, s: r.s, o: r.o, ltype: r.ltype, vtype: r.vtype, bw: r.bw, an: r.an, st: r.st,
      cols: r.c.map((x) => ({ L: +x.light.toFixed(2), hue: x.hue, ink: x.ink, ink2: x.ink2, mix: +x.mix.toFixed(4), tint: +x.tint.toFixed(4), shade: +x.shade.toFixed(4), kind: x.kind, hex: hex2(x.col) })),
      bars: bars.join(''),
    },
    r,
  };
}

const VT = ['none', 'analogous', 'complementary', 'monochromatic', 'achromatic', 'saturated', 'tinted'];
const labDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Summary metrics for one hash. Columns listed in COLS (header line of every .tsv.gz).
const COLS = ['i', 'bars', 'o', 'lt', 'vt', 'ratio', 'restarts', 'calls', 'redraws', 'pins', 'plainT', 'spanMin', 'spanMid', 'spanMax', 'nflat',
  'nDistBars', 'nDistPar', 'meanL', 'minL', 'maxL', 'meanC', 'maxC', 'hueSpread', 'nTint', 'nShade', 'maxShade', 'minShade', 'mixMin', 'mixMax',
  'aspan', 'aend', 'mirror', 'shareEnds', 'lmin', 'dmin', 'minAdj', 'minParL', 'maxParL', 'nInks'];
function summarize(idx, hash) {
  const { row, r } = fullRow(hash);
  const labs = r.c.map((x) => ctx.__lab(x.col));
  const spans = [0, 1, 2].map((j) => labDist(labs[2 * j], labs[2 * j + 1])).sort((a, b) => a - b);
  const nflat = spans.filter((x) => x < 2).length;
  const barHex = row.bars.match(/.{6}/g);
  const nDistBars = new Set(barHex).size;
  // distinct parent colours, Lab < 2 clustering (greedy)
  const reps = [];
  for (const L of labs) if (!reps.some((q) => labDist(q, L) < 2)) reps.push(L);
  // per-bar Lab stats, area-weighted by bar width
  let sw = 0, sL = 0, sC = 0, minL = 1e9, maxL = -1e9, maxC = 0, minAdj = 1e9;
  const barLabs = [];
  for (let i = 0; i < r.s; i++) for (let j = 0; j < 3; j++) {
    const lab = ctx.__lab(ctx.__lerp(r.c[2 * j].col, r.c[2 * j + 1].col, i / (r.s - 1)));
    barLabs.push(lab);
    const C = Math.hypot(lab[1], lab[2]);
    const wgt = r.bw[j];
    sw += wgt; sL += wgt * lab[0]; sC += wgt * C;
    if (lab[0] < minL) minL = lab[0]; if (lab[0] > maxL) maxL = lab[0]; if (C > maxC) maxC = C;
  }
  for (let k = 1; k < barLabs.length; k++) minAdj = Math.min(minAdj, labDist(barLabs[k], barLabs[k - 1]));
  // hue spread of parents (smallest arc covering all hues)
  const hues = r.c.map((x) => x.hue).sort((a, b) => a - b);
  let gap = hues[0] + 360 - hues[5];
  for (let j = 1; j < 6; j++) gap = Math.max(gap, hues[j] - hues[j - 1]);
  const hueSpread = 360 - gap;
  // mirrored pair: interval a runs X->Y and interval b runs Y->X
  let mirror = 0;
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++)
    if (labDist(labs[2 * a], labs[2 * b + 1]) < 2 && labDist(labs[2 * a + 1], labs[2 * b]) < 2) mirror++;
  // interval end equal to another interval's start (shared colour between intervals)
  let shareEnds = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b && labDist(labs[2 * a + 1], labs[2 * b]) < 2) shareEnds++;
  const ws = r.bw.map((x) => x / Math.min(...r.bw)).map((x) => Math.round(x)).sort((a, b) => a - b).join(':');
  const kinds = r.c.map((x) => x.kind);
  const shades = r.c.map((x) => x.shade);
  const mixes = r.c.map((x) => x.mix);
  const inkSet = new Set();
  for (const x of r.c) { if (x.kind !== 'shade' || x.shade < 1) { if (r.vtype !== 'achromatic') { if (x.mix < 1 - 1e-3) inkSet.add(x.ink); if (x.mix > 1e-3) inkSet.add(x.ink2); } } if (x.shade > 0) inkSet.add(8); }
  const parL = labs.map((l) => l[0]);
  const f2 = (x) => +x.toFixed(2);
  const vals = [idx, 3 * r.s, r.o, r.ltype === 'varied' ? 1 : 0, VT.indexOf(r.vtype), ws, r.st.j0 - 1, r.st.calls, r.st.redraws, r.st.pins, r.st.plainTrue,
    f2(spans[0]), f2(spans[1]), f2(spans[2]), nflat, nDistBars, reps.length, f2(sL / sw), f2(minL), f2(maxL), f2(sC / sw), f2(maxC), hueSpread,
    kinds.filter((k) => k === 'tint').length, kinds.filter((k) => k === 'shade').length, +Math.max(...shades).toFixed(4), +Math.min(...shades).toFixed(4),
    +Math.min(...mixes).toFixed(4), +Math.max(...mixes).toFixed(4), r.an ? r.an[0] : -1, r.an ? r.an[2] : -1, mirror, shareEnds, r.lmin, r.dmin, f2(minAdj),
    f2(Math.min(...parL)), f2(Math.max(...parL)), inkSet.size];
  // rare = keep full row
  const rare = nflat >= 2 || r.st.j0 - 1 >= 3 || mirror > 0 || nDistBars <= 6 || shareEnds >= 2 ||
    (nflat >= 1 && ['none', 'analogous', 'saturated'].includes(r.vtype)) ||
    sL / sw > 88 || sL / sw < 22 || spans[2] < 5;
  return { vals, rare, row };
}

const hashAt = (i) => '0x' + crypto.createHash('sha256').update('intervals-r3:' + i).digest('hex');

const mode = process.argv[2];
if (mode === 'list') {
  const hs = fs.readFileSync(process.argv[3], 'utf8').split(/\s+/).filter(Boolean);
  const out = fs.openSync(process.argv[4], 'w');
  for (const h of hs) fs.writeSync(out, JSON.stringify(fullRow(h).row) + '\n');
  fs.closeSync(out);
} else if (mode === 'range') {
  const start = +process.argv[3], end = +process.argv[4], pre = process.argv[5];
  const gz = zlib.createGzip({ level: 6 });
  const tsv = fs.createWriteStream(pre + '.tsv.gz');
  gz.pipe(tsv);
  const rareFd = fs.openSync(pre + '.rare.jsonl', 'a');
  gz.write(COLS.join('\t') + '\n');
  const t0 = Date.now();
  let buf = [];
  for (let i = start; i < end; i++) {
    const h = hashAt(i);
    const { vals, rare, row } = summarize(i, h);
    buf.push(vals.join('\t'));
    if (rare) fs.writeSync(rareFd, JSON.stringify({ i, ...row }) + '\n');
    if (buf.length === 2000) {
      gz.write(buf.join('\n') + '\n'); buf = [];
      if ((i + 1 - start) % 50000 === 0) {
        fs.writeFileSync(pre + '.progress', `${i + 1 - start} ${((Date.now() - t0) / 1000).toFixed(0)}\n`);
      }
    }
  }
  if (buf.length) gz.write(buf.join('\n') + '\n');
  fs.closeSync(rareFd);
  await new Promise((res) => { tsv.on('finish', res); gz.end(); });
  fs.writeFileSync(pre + '.done', `${end - start} ${((Date.now() - t0) / 1000).toFixed(0)}\n`);
} else if (mode === 'bench') {
  const n = +process.argv[3] || 2000;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) summarize(i, hashAt(i));
  console.log(n, 'hashes', (Date.now() - t0) / n, 'ms/hash');
} else if (mode === 'hash') {
  console.log(hashAt(+process.argv[3]));
} else if (mode === 'one') {
  const { vals } = summarize(-1, process.argv[3]);
  const o = Object.fromEntries(COLS.map((k, n) => [k, vals[n]]));
  console.log(JSON.stringify({
    hash: process.argv[3], bars: o.bars, orientation: o.o === 0 ? 'Vertical' : 'Horizontal', widths: o.lt === 1 ? 'Varied' : 'Even',
    variant: VT[o.vt], ratio: o.ratio, restarts: o.restarts, intervalSpansLab: [o.spanMin, o.spanMid, o.spanMax], flatIntervals: o.nflat,
    static: o.nflat === 3, distinctBarColours: o.nDistBars,
  }, null, 1));
}
