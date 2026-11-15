# Intervals: a 10 million hash screen

This repository records a search of 10,000,000 hashes of Jeff Davis's generative work Intervals (https://heftgallery.com/intervals) and gives anyone the means to repeat it.

## The claim

Of the 10,000,000 hashes in the sequence defined below, 11,609 produce an output in which none of the three colour intervals visibly changes from its start colour to its end colour. Exactly one of those has no colour variant:

```
0xf3272f16d61ef001a19ba58896be525aed9b252872e3684502e1200541cf60c0
```

It is hash number 9,836,373 in the sequence. View it at https://heftgallery.com/intervals?seed=0xf3272f16d61ef001a19ba58896be525aed9b252872e3684502e1200541cf60c0

| Colour variant | Hashes | No visible blend |
|---|---|---|
| None | 5,498,949 | 1 |
| Analogous | 1,498,724 | 13 |
| Saturated | 1,201,665 | 14 |
| Tinted | 900,693 | 71 |
| Complementary | 500,707 | 865 |
| Monochromatic | 299,119 | 10,371 |
| Achromatic | 100,143 | 274 |
| Total | 10,000,000 | 11,609 |

`statics.tsv` lists all 11,609 with their index, hash and traits.

## Definitions

**The sequence.** Hash number `i` is `0x` followed by the hex SHA-256 of the text `intervals-r3:` joined to `i` written as a decimal integer. The screen covers `i` from 0 to 9,999,999. The sequence was fixed before the screen ran, and nothing was selected from outside it.

**No visible blend.** Intervals draws three colour intervals. Each one runs from a start colour to an end colour across the bars. The screen measures the distance between those two colours in CIELAB. An output counts when all three distances are under 2 units, which is below what the eye separates in adjacent bars. The piece above measures 0, 1.38 and 1.64. The count depends on the threshold: among outputs with no colour variant, 1 has all three distances under 2 units, 2 have them under 3, 9 under 4 and 18 under 5.

**Colour variant.** The trait named Color Variant in the artist's script. "None" is the default palette, where each interval takes its own hue.

## Check one hash

You need Node.js 20 or later.

```
node verify.mjs hash 0xf3272f16d61ef001a19ba58896be525aed9b252872e3684502e1200541cf60c0
```

The command prints the traits, the three interval distances and whether the output counts. Compare the traits with the page for that seed on heftgallery.com.

## Re-run part of the screen

The 10,000,000 hashes are split into 100 chunks of 100,000. `manifest.json` holds two SHA-256 digests for each chunk, and the counts for each variant.

```
node verify.mjs chunk 98
```

The command recomputes every hash in the chunk and prints `MATCH` or `MISMATCH` for both digests. Chunk 98 contains the piece above. One chunk takes about 10 minutes of processor time, split across the cores of the machine. To repeat the whole screen, run chunks 0 to 99.

The core digest covers the index, bar count, orientation, width type, variant, width ratio, palette restarts and the count of flat intervals. The full digest covers every column of the row, which includes numbers rounded to two decimals. The core digest is the claim. The full digest matched on two machines with Node.js 26.13.1, and a different JavaScript engine version can round a last digit differently.

## How the screen works

`screen3.mjs` runs the artist's unmodified `intervals.js` inside Node.js with a small stand-in for the p5.js colour and maths calls that `setup()` uses. It does not draw. Before the screen ran, its output was compared with the same script running in a browser on 100,000 hashes, and every value agreed.

`intervals.js` is not in this repository. `verify.mjs` downloads it from heftgallery.com and stops if its SHA-256 is not `38c234b2a0d5715604136f33cf6c6dbd2afc9c7609691225ec81b9eac16a9be3`.

## Limits

The claim is about these 10,000,000 hashes. It is not a claim about every possible hash. At the measured rate, a wider search will find more outputs of the same kind.

## Credits

Intervals is by Jeff Davis and is licensed CC BY-NC 4.0. The colour conversion in `screen3.mjs` follows p5.js 1.9.0 (LGPL-2.1). The screen and this repository are by Benjamin Meadows. The code is MIT-licensed, except the p5 shim in `screen3.mjs`, which stays LGPL-2.1; `LICENSE` has the details.
