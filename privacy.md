# Privacy Policy — Markdown Clipboard

_Last updated: 2026-07-13_

Markdown Clipboard is designed to do all of its work locally, inside your
browser. It does not collect, transmit, sell, or share any personal data.

## What the extension accesses

- **Your clipboard** (`clipboardRead` / `clipboardWrite`): when you trigger a
  conversion, the extension reads the HTML currently on your clipboard, converts
  it to Markdown, and writes the result back to your clipboard. Clipboard
  contents are processed in memory on your device and are never sent anywhere.
- **The active page** (`activeTab`, content script): the "copy selection as
  Markdown" feature reads the current selection on the page you explicitly act
  on, converts it, and places the result on your clipboard. Page content is not
  stored or transmitted.

## What the extension does **not** do

- No analytics, telemetry, or tracking.
- No remote servers, network requests, or external APIs — the conversion runs
  entirely on your machine.
- No accounts, no cookies, no advertising identifiers.
- No storage of your clipboard or page contents beyond the moment of conversion.

## Data collection declaration

For the Firefox Add-ons store, this extension declares **no data collection**
(`data_collection_permissions: { required: ["none"] }`).

## Contact

Questions about this policy: ai@ckaeser.de

The full source code is available at
https://github.com/ChristianKaeser/markdown-clipboard
