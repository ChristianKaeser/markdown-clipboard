import {convertClipboardToMarkdown} from './clipboard-convert.js';
import type {OffscreenRequest} from './protocol.js';

// Chromium-only: hosts clipboard access for the service worker, which has no DOM.
chrome.runtime.onMessage.addListener((message: OffscreenRequest, _sender, sendResponse) => {
	if (message.target !== 'offscreen' || message.type !== 'convert-clipboard') {
		return;
	}

	convertClipboardToMarkdown().then(sendResponse);
	return true; // Keep the message channel open for the async response
});
