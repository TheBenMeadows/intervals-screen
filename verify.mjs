#!/usr/bin/env node
// Re-run part of the screen and compare it with manifest.json.
//
//   node verify.mjs chunk <n> [jobs]   re-run chunk n (100,000 hashes) and compare both digests
//   node verify.mjs hash <0x...>       print the screen's row for one hash
//   node verify.mjs index <i>          print hash number i of the sequence and its row
//
// intervals.js is the artist's script and is not part of this repository. If it is not next to
// this file, it is downloaded from heftgallery.com and its sha256 is checked against the manifest.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const ART = path.join(HERE, 'intervals.js');
const ART_URL = 'https://heftgallery.com/art/intervals/intervals.js';
const CORE = [0, 1, 2, 3, 4, 5, 6, 14];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function needArt() {
  if (!fs.existsSync(ART)) {
    const res = await fetch(ART_URL);
    if (!res.ok) throw new Error(`download of ${ART_URL} failed with HTTP ${res.status}`);
    fs.writeFileSync(ART, Buffer.from(await res.arrayBuffer()));
  }
  const got = sha(fs.readFileSync(ART));
  if (got !== manifest.sha256['intervals.js']) {
    throw new Error(`intervals.js sha256 is ${got}, the manifest expects ${manifest.sha256['intervals.js']}`);
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(HERE, 'screen3.mjs'), ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, INTERVALS_JS: ART } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`screen3.mjs exited with ${code}`))));
  });
}

async function chunk(n, jobs) {
  const c = manifest.chunks[n];
  if (!c) throw new Error(`chunk ${n} is not in the manifest (0..${manifest.chunks.length - 1})`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intervals-verify-'));
  const per = Math.ceil((c.end - c.start) / jobs);
  const parts = [];
  for (let k = 0; k < jobs; k++) {
    const s = c.start + k * per, e = Math.min(c.end, s + per);
    if (s < e) parts.push({ s, e, pre: path.join(tmp, `p${k}`) });
  }
  await Promise.all(parts.map((p) => run(['range', String(p.s), String(p.e), p.pre])));
  const full = crypto.createHash('sha256'), core = crypto.createHash('sha256');
  let statics = 0;
  for (const p of parts) {
    const lines = zlib.gunzipSync(fs.readFileSync(p.pre + '.tsv.gz')).toString('utf8').split('\n');
    for (const line of lines.slice(1)) {
      if (!line) continue;
      const f = line.split('\t');
      full.update(line + '\n');
      core.update(CORE.map((k) => f[k]).join('\t') + '\n');
      if (f[14] === '3') statics++;
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const gotCore = core.digest('hex'), gotFull = full.digest('hex');
  console.log(`chunk ${n}: hashes ${c.start}..${c.end - 1}, statics found ${statics}`);
  console.log(`core digest ${gotCore === c.core ? 'MATCH' : 'MISMATCH'}  ${gotCore}`);
  console.log(`full digest ${gotFull === c.full ? 'MATCH' : 'MISMATCH'}  ${gotFull}`);
  process.exitCode = gotCore === c.core ? 0 : 1;
}

const [mode, arg, jobsArg] = process.argv.slice(2);
await needArt();
if (mode === 'chunk') await chunk(+arg, Math.max(1, +jobsArg || os.availableParallelism() - 1));
else if (mode === 'hash') process.stdout.write(await run(['one', arg]));
else if (mode === 'index') process.stdout.write(await run(['one', (await run(['hash', arg])).trim()]));
else { console.error('usage: node verify.mjs chunk <n> [jobs] | hash <0x...> | index <i>'); process.exitCode = 2; }
