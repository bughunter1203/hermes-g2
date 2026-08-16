# Store listing assets

Assets for the Even Hub store listing of **Hermes G2** (`ai.crewnova.hermesg2`).

## The slots, verified against live listings

These were guesses before. They are now measured. `GET
https://hub.evenrealities.com/api/v1/apps/landing?package_id=<id>` is public and
returns the exact assets the Hub serves for a published app. Two live listings
were pulled and their files downloaded from the CDN:

| Field | Format | Size | Count |
|---|---|---|---|
| `icon` | **SVG**, `viewBox="0 0 24 24"`, one `<path>`, `fill="currentColor"` | ~300 bytes | 1 |
| `foreground` | lossless WebP, **RGBA with alpha** | **576×288** | **array** — 6 and 3 in the two samples |
| `background` | WebP | **1024×1024** | 1 |
| `tagline` | one line of text | — | 1 |

Samples: `com.titancakee.hermesvoice` (Hermes Voice, Eduard Röhrig, 6 foregrounds)
and `com.sangmun.hermes` (Hermes, Sangmun Choi, 3 foregrounds). Both are forks of
the same upstream this repo forks.

Three things that change how the assets must be drawn:

1. **`foreground` is the screenshots, not artwork.** They are 576×288 — the
   glasses resolution — with a transparent field and pure `#00FF00` text
   (sampled from the pixels). The Hub composites them over `background`.
2. **`background` is square**, not a 2:1 banner. Both live apps use a large
   (~500 KB) blurred photographic interior.
3. **The icon is tinted.** `fill="currentColor"` means the Hub picks the colour.
   An icon that bakes in its own fill ignores that.

The earlier revert of this directory said these slots did not exist. They do —
that reading came from one dialog in the console and was wrong.

## Files

| File | Size | Maps to |
|---|---|---|
| `icon.svg` | 24×24 viewBox, `currentColor` | ✅ `icon` |
| `background.svg` → `background-1024.png` | 1024×1024 | ✅ `background` |
| `store/screenshots/*.png` (generated) | 576×288 RGBA | ✅ `foreground[]` |
| `icon-1024/512/256/128.png` | square | README/GitHub use; no verified slot |
| `foreground.svg` → `foreground-*.png` | square, transparent | speculative "layered icon" top layer |
| `icon-background.svg` → `icon-background-*.png` | square, opaque | speculative "layered icon" bottom layer |

The last two rows are kept rather than deleted. The landing endpoint shows no
layered-icon field, but that endpoint is the public *share* view — it is not
proof the console lacks the option. Deleting on partial evidence is the mistake
that lost this directory the first time.

Re-export any size:

```sh
rsvg-convert -w 1024 -h 1024 background.svg -o background-1024.png
```

## Why they look like this

The guidelines reject colour assets and reject illegible ones — no "black
scribble", no noisy patterns. So: a `>_` terminal prompt, one glyph, high
contrast, readable at 128 px. The mark matches the app itself, which is a
terminal-style surface: `>` for your entries, `/` for tool calls, plain lines for
the assistant.

The background stays near-black with an 8% watermark. It sits *under* green
576×288 text, so anything busy fights the thing people are meant to read.

## Screenshots — the foreground layer

Capture through the simulator against a real bridge, so the conversation in them
is real:

```sh
npm run dev     # terminal 1
npm run sim     # terminal 2
npm run shots   # terminal 3 — guided capture
```

See `scripts/capture-store-shots.mjs`. It writes 576×288 PNGs to
`store/screenshots/`.

**Unverified:** whether the simulator's `/api/screenshot/glasses` returns green
on transparent, or white on opaque black. The live foregrounds are green on
transparent. Check the first captured frame before uploading a set — if it comes
back opaque, the composite over `background` will be a black rectangle instead of
floating text.
