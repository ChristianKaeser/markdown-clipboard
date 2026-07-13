# <img src="icons/icon-48.png" width="38" align="left"> Markdown Clipboard

> Browser extension (Chromium + Firefox, Manifest V3) to copy page content as Markdown — and to convert HTML already sitting on your clipboard to Markdown with one click.

## Features

### Convert clipboard HTML to Markdown (toolbar icon / `Alt+Shift+X`)

When you copy rich text (e.g. from a web app), the clipboard carries both a plain-text and an HTML flavor. Click the toolbar icon and the extension:

1. reads the `text/html` clipboard flavor,
2. converts it to Markdown (inline code → `` `backticks` ``, bold, italics, links, lists, tables, fenced code blocks, MathML → LaTeX),
3. writes the Markdown back as the new `text/plain` flavor **while re-writing the original HTML flavor**, so pasting into rich-text targets keeps working,
4. plays a small animation on the toolbar icon: green checkmark (converted), amber dash (no HTML on the clipboard), red cross (error).

No popup, no page interaction — the conversion happens silently in the background (Firefox: background event page; Chromium: offscreen document).

Non-breaking spaces from rich-text sources are normalized to regular spaces.

### Copy page content as Markdown (context menu / `Alt+X`)

Carried over from [notlmn/copy-as-markdown](https://github.com/notlmn/copy-as-markdown) (MIT):

- Right-click a link, image, or selection → *Copy … as Markdown*.
- `Alt+X` copies the current selection as Markdown.
- GFM tables, task lists, strikethrough; fenced code blocks with language detection; MathML → LaTeX.

## Development

```sh
pnpm install
pnpm run check          # typecheck + tests + build both targets
pnpm run build          # build dist/chrome and dist/firefox
pnpm run build:chrome   # single target
pnpm run watch          # rebuild on change
```

Load the unpacked extension:

- **Chromium**: `chrome://extensions` → Developer mode → *Load unpacked* → `dist/chrome`
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `dist/firefox/manifest.json`

Icons are generated with `powershell -File scripts/make-icons.ps1` (checked in, so this is only needed when changing the design).

## Packaging & publishing

```sh
pnpm run lint:ext        # web-ext lint on dist/firefox (same validator AMO runs)
pnpm run package:firefox # → web-ext-artifacts/markdown-clipboard-firefox-<version>.zip
pnpm run package:chrome  # → web-ext-artifacts/markdown-clipboard-chrome-<version>.zip
pnpm run package:source  # → web-ext-artifacts/source.zip (for AMO's source review)
pnpm run release         # build + lint + all three packages
```

- **Firefox (AMO, listed):** upload the firefox zip and the source zip at
  <https://addons.mozilla.org/developers/>. The privacy policy is
  [`privacy.md`](privacy.md). The manifest already carries the `gecko` id and the
  `data_collection_permissions: { required: ["none"] }` declaration required for
  new submissions.
- **Chrome Web Store:** upload the chrome zip; declare "no data collection" and
  justify `clipboardRead` and the content script.

To bump the version, edit `version` in `build.mjs` and `package.json`, rebuild,
then re-package.

## Architecture notes

- `src/markdown.ts` — shared Turndown configuration (rules ported from the reference extension).
- `src/clipboard-convert.ts` — reads/writes the clipboard in a DOM context. Prefers the async Clipboard API, falls back to `execCommand`-based paste/copy interception (needed in Chromium's offscreen document, which is never focused).
- `src/background.ts` — one bundle for both browsers. Chromium's service worker has no DOM, so it delegates conversion to `src/offscreen.ts`; Firefox's background event page converts directly. The build aliases `#convert-host` per target so Turndown isn't shipped in the Chromium worker.
- `src/icon-animation.ts` — canvas-drawn toolbar icon animation (OffscreenCanvas, with a badge-text fallback).
- `build.mjs` — esbuild + per-target `manifest.json` generation.

## Permissions

- `clipboardRead` / `clipboardWrite`: the core feature.
- `contextMenus`: the right-click entries.
- `activeTab`: access to the page for selection copying.
- `offscreen` (Chromium only): clipboard access for the service worker.

## Credits

- Conversion rules and the copy-as-Markdown feature set are based on [notlmn/copy-as-markdown](https://github.com/notlmn/copy-as-markdown) (MIT), kept in `reference/` locally.
- HTML → Markdown by [turndown](https://github.com/mixmark-io/turndown) with [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) and [mathml-to-latex](https://github.com/asnunes/mathml-to-latex).
