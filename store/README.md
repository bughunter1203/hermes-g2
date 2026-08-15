# Store listing assets

Assets for the Even Hub store listing of **Hermes G2** (`ai.crewnova.hermesg2`).

The submission guidelines name three mandatory image slots — **icon**,
**foreground**, and **background** — each rejected if `null` or empty. They do
not say whether the icon is a single composed image or the foreground/background
pair composited. Both readings are covered here, so whichever the console asks
for, a file exists.

## Files

| File | Size | Use |
|---|---|---|
| `icon.svg` → `icon-1024/512/256/128.png` | square | **composed** icon: glyph on its own dark rounded field |
| `foreground.svg` → `foreground-1024/512/256.png` | square, transparent | **layered** icon, top layer: glyph only |
| `icon-background.svg` → `icon-background-1024/512/256.png` | square, opaque | **layered** icon, bottom layer: flat field |
| `background.svg` → `background-1152x576.png` `background-1920x960.png` | 2:1 | listing background / banner |

Re-export any size:

```sh
rsvg-convert -w 1024 -h 1024 icon.svg -o icon-1024.png
```

Preview the layered pair as the console would composite it:

```sh
python3 -c "from PIL import Image; \
bg=Image.open('icon-background-512.png').convert('RGBA'); \
fg=Image.open('foreground-512.png').convert('RGBA'); \
Image.alpha_composite(bg,fg).show()"
```

## Why they look like this

The guidelines reject color assets and reject illegible ones — no "black
scribble", no noisy patterns. So: a `>_` terminal prompt, thick strokes, one
glyph, high contrast. It still reads at 128 px, which is the size that decides
whether an icon works.

The mark matches the app itself, which is a terminal-style surface: `>` for your
entries, `/` for tool calls, plain lines for the assistant.

The foreground glyph sits at 85% and centred, so a circular or rounded mask
cannot clip it. The banner background is near-black with a 10% watermark — a
backdrop, not a second logo, and a busy one risks the "noisy pattern" rejection.

## Verified

- **Greyscale**: every pixel satisfies R=G=B across all exports (0 non-grey
  pixels). Color assets are rejected.
- **Legibility**: icon checked at 128 px.
- **Masking**: layered pair composited and checked; the glyph clears the corners.

## Not verified

**The console's slot names, required dimensions, and file formats are not
documented** on `/docs/ship/app-submission`, and the console is behind a login.
The sizes here are conventional guesses. Open the upload form, then re-export
from the SVG masters — that is a one-line command, not a redraw.

## Screenshots

Screenshots are **not** required to submit. The guidelines validate them only if
provided ("Screenshots match what the app actually renders on device"), with no
minimum count, unlike the image slots above which are explicitly rejected when
empty.

When you do add them, capture through the simulator's screenshot function
(576×288 RGBA PNG) against a real bridge, so the conversation in them is real:

```sh
npm run dev     # terminal 1
npm run sim     # terminal 2
npm run shots   # terminal 3 — guided capture
```

See `scripts/capture-store-shots.mjs`.
