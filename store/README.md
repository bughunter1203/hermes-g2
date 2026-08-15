# Store listing assets

Assets for the Even Hub store listing of **Hermes G2** (`ai.crewnova.hermesg2`).

## Files

| File | Size | Use |
|---|---|---|
| `icon.svg` | vector | icon master — re-export at whatever size the console asks for |
| `icon-1024.png` `icon-512.png` `icon-256.png` `icon-128.png` | square | icon uploads |
| `background.svg` | vector | background master |
| `background-1152x576.png` | 2:1 | background upload (2× the 576×288 glasses display) |
| `background-1920x960.png` | 2:1 | background upload, larger |

Re-export any size with:

```sh
rsvg-convert -w 1024 -h 1024 icon.svg -o icon-1024.png
```

## Why they look like this

The submission guidelines reject color assets and reject illegible ones — no
"black scribble", no noisy patterns. So: a `>_` terminal prompt, thick strokes,
one glyph, high contrast. It still reads at 128 px, which is the size that
decides whether an icon works.

The mark matches the app itself, which is a terminal-style surface: `>` for your
entries, `/` for tool calls, plain lines for the assistant.

The background is deliberately near-black with a 10% watermark. It is a backdrop,
not a second logo, and a busy one risks the "noisy pattern" rejection.

## Verified

- **Greyscale**: every pixel satisfies R=G=B in all exports (checked, 0 non-grey
  pixels). Color assets are rejected.
- **Legibility**: icon checked at 128 px.

## Not verified

**The console's required dimensions and file format are not documented** on
`/docs/ship/app-submission`, and the console is behind a login. The sizes here
are conventional guesses. Check the upload form and re-export from the SVG
masters if it wants something else — that is a one-line command, not a redraw.

## Screenshots

Screenshots do **not** belong here. The guidelines require them to match what
the app actually renders on device, captured through the simulator's screenshot
function, which emits 576×288 RGBA PNGs. Capture them against a real bridge so
the content is real too. See `docs/e2e/` for the format.
