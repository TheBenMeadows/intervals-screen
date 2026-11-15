# Intervals: a 100 million hash screen

This repository records a search of 100,000,000 hashes of Jeff Davis's generative work Intervals (https://heftgallery.com/intervals) and gives anyone the means to repeat it. The first version of this repository covered the first 10,000,000. This version extends the same sequence with the same script, and the digests of those first 100 chunks are unchanged.

## The claim

Of the 100,000,000 hashes in the sequence defined below, 116,561 produce an output in which none of the three colour intervals visibly changes from its start colour to its end colour. Exactly two of those have no colour variant:

```
0xf3272f16d61ef001a19ba58896be525aed9b252872e3684502e1200541cf60c0
0xf758e8eb68e936ce2b648009374dbab4a453ac22e47b7bd9d8ae1089d30967ee
```

They are hash numbers 9,836,373 and 11,318,975 in the sequence. The first is the only one in the first 10,000,000. View them at https://heftgallery.com/intervals?seed=0xf3272f16d61ef001a19ba58896be525aed9b252872e3684502e1200541cf60c0 and https://heftgallery.com/intervals?seed=0xf758e8eb68e936ce2b648009374dbab4a453ac22e47b7bd9d8ae1089d30967ee

| Colour variant | Hashes | No visible blend |
|---|---|---|
| None | 54,994,295 | 2 |
| Analogous | 15,002,912 | 58 |
| Saturated | 12,001,420 | 159 |
| Tinted | 8,998,268 | 762 |
| Complementary | 5,003,969 | 8,644 |
| Monochromatic | 2,999,970 | 104,031 |
| Achromatic | 999,166 | 2,905 |
| Total | 100,000,000 | 116,561 |

`statics.tsv` lists all 116,561 with their index, hash and traits.

## Definitions

**The sequence.** Hash number `i` is `0x` followed by the hex SHA-256 of the text `intervals-r3:` joined to `i` written as a decimal integer. The screen covers `i` from 0 to 99,999,999. The sequence was fixed before the screen ran, and nothing was selected from outside it.

**No visible blend.** Intervals draws three colour intervals. Each one runs from a start colour to an end colour across the bars. The screen measures the distance between those two colours in CIELAB. An output counts when all three distances are under 2 units, which is below what the eye separates in adjacent bars. The two pieces above measure 0, 1.38 and 1.64, and 0.42, 1.08 and 1.33. The count depends on the threshold: among outputs with no colour variant, 2 have all three distances under 2 units, 24 have them under 3, 72 under 4 and 165 under 5.

**Colour variant.** The trait named Color Variant in the artist's script. "None" is the default palette, where each interval takes its own hue.

## Check one hash

You need Node.js 20 or later.

```
node verify.mjs hash 0xf758e8eb68e936ce2b648009374dbab4a453ac22e47b7bd9d8ae1089d30967ee
```

The command prints the traits, the three interval distances and whether the output counts. Compare the traits with the page for that seed on heftgallery.com.

## Re-run part of the screen

The 100,000,000 hashes are split into 1,000 chunks of 100,000. `manifest.json` holds two SHA-256 digests for each chunk, and the counts for each variant.

```
node verify.mjs chunk 113
```

The command recomputes every hash in the chunk and prints `MATCH` or `MISMATCH` for both digests. Chunk 98 contains the first piece above and chunk 113 the second. One chunk takes about 10 minutes of processor time, split across the cores of the machine. To repeat the whole screen, run chunks 0 to 999.

The core digest covers the index, bar count, orientation, width type, variant, width ratio, palette restarts and the count of flat intervals. The full digest covers every column of the row, which includes numbers rounded to two decimals. The core digest is the claim. The full digest matched on every machine used: Node.js 26.13.1 on macOS (Apple silicon) and on Linux x86-64, and Node.js 22.23.4 on Linux x86-64. Another JavaScript engine version could still round a last digit differently.

`manifest.sha256` holds the SHA-256 of `manifest.json`.

## How the screen works

`screen3.mjs` runs the artist's unmodified `intervals.js` inside Node.js with a small stand-in for the p5.js colour and maths calls that `setup()` uses. It does not draw. Before the screen ran, its output was compared with the same script running in a browser on 100,000 hashes, and every value agreed. Chunks 0 to 99 come from the first run, chunks 100 to 499 from a second run of the same script on the same machine, and chunks 500 to 999 from a third run split across six machines. Before each machine was used, it reproduced the same 20,000 rows with identical digests. Five chunks that ran on two or three machines at once gave identical digests on each.

`intervals.js` is not in this repository. `verify.mjs` downloads it from heftgallery.com and stops if its SHA-256 is not `38c234b2a0d5715604136f33cf6c6dbd2afc9c7609691225ec81b9eac16a9be3`.

## Limits

The claim is about these 100,000,000 hashes. It is not a claim about every possible hash. At the measured rate, a wider search will find more outputs of the same kind.

## Credits

Intervals is by Jeff Davis and is licensed CC BY-NC 4.0. The colour conversion in `screen3.mjs` follows p5.js 1.9.0 (LGPL-2.1). The screen and this repository are by Benjamin Meadows. The code is MIT-licensed, except the p5 shim in `screen3.mjs`, which stays LGPL-2.1; see `LICENSE` and `NOTICE`.
