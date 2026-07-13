import type {ConversionResult, OffscreenRequest} from './protocol.js';

/**
 * Chromium `#convert-host`. The service worker has no DOM or clipboard access,
 * so it delegates conversion to the offscreen document (which bundles Turndown).
 * Keeping the `chrome.offscreen` calls here — rather than in the shared
 * `background.ts` — keeps them out of the Firefox bundle, where that API does
 * not exist. Firefox resolves `#convert-host` to `clipboard-convert.ts`, which
 * converts directly in the background event page.
 */
export async function convertClipboardToMarkdown(): Promise<ConversionResult> {
	await ensureOffscreenDocument();
	const request: OffscreenRequest = {type: 'convert-clipboard', target: 'offscreen'};
	return chrome.runtime.sendMessage(request);
}

async function ensureOffscreenDocument(): Promise<void> {
	if (await chrome.offscreen.hasDocument()) {
		return;
	}

	await chrome.offscreen.createDocument({
		url: 'offscreen.html',
		reasons: [chrome.offscreen.Reason.CLIPBOARD],
		justification: 'Read HTML from the clipboard and write back its Markdown conversion',
	});
}
