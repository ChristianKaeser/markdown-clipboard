import {animateActionIcon} from './icon-animation.js';
// Resolved per build target: direct DOM conversion on Firefox (the background
// event page has a DOM), offscreen-document delegation on Chromium.
import {convertClipboardToMarkdown} from '#convert-host';
import type {ContentRequest, ConversionResult} from './protocol.js';

// Chrome does not expose the `browser` namespace yet.
const browserApi = globalThis.browser ?? globalThis.chrome;

// --- Context menus (copy link / image / selection as Markdown) -------------

const MENU_CONTEXTS = ['image', 'link', 'selection'] as const;

async function registerContextMenus(): Promise<void> {
	await browserApi.contextMenus.removeAll();
	for (const context of MENU_CONTEXTS) {
		browserApi.contextMenus.create({
			id: `cpy-as-md:${context}`,
			title: `Copy ${context} as Markdown`,
			contexts: [context],
			// Only offer the menu where we can actually inject: real web pages.
			// This hides it on `about:`, `view-source:`, `file:`, `data:`, and
			// extension pages, where script injection is impossible anyway.
			// (Restricted *https* domains like addons.mozilla.org can't be
			// filtered here without the `tabs`/host permission we deliberately
			// dropped, so those fall back to the error animation on click.)
			documentUrlPatterns: ['*://*/*'],
		});
	}
}

// Menus must be (re-)registered when the extension is installed or updated,
// and on browser startup for Firefox event pages.
browserApi.runtime.onInstalled.addListener(registerContextMenus);
browserApi.runtime.onStartup.addListener(registerContextMenus);

/**
 * Deliver a copy request to the page. There is no persistent content script:
 * the copy features run under `activeTab`, which a context-menu click or a
 * keyboard command grants for the tab in question. We inject `content.js` on
 * demand (idempotent — it guards its own listener) and then message it. This is
 * what lets the extension work without the "access your data for all websites"
 * host permission.
 */
async function copyInTab(tabId: number, message: ContentRequest): Promise<void> {
	await browserApi.scripting.executeScript({
		target: {tabId},
		files: ['content.js'],
	});
	await browserApi.tabs.sendMessage(tabId, message);
}

browserApi.contextMenus.onClicked.addListener(async (info, tab) => {
	if (tab?.id === undefined) {
		return;
	}

	// `linkText` is Firefox-only and missing from the Chrome typings
	const text = (info as typeof info & {linkText?: string}).linkText ?? '';
	const message: ContentRequest = {
		type: 'copy-as-markdown',
		actionType: 'selection',
		htmlContent: '',
	};

	if (String(info.menuItemId).endsWith('image')) {
		const assetUrl = encodeURI(info.srcUrl ?? '');
		message.actionType = 'image';
		message.htmlContent = `<img alt="${text || assetUrl}" src="${assetUrl}" />`;
	} else if (String(info.menuItemId).endsWith('link')) {
		const linkUrl = encodeURI(info.linkUrl ?? '');
		message.actionType = 'link';
		message.htmlContent = `<a href="${linkUrl}">${text || linkUrl}</a>`;
	}

	try {
		await copyInTab(tab.id, message);
	} catch (error) {
		// Injection is blocked on restricted domains (e.g. addons.mozilla.org).
		// Signal that instead of failing silently.
		console.error('[markdown-clipboard]', error);
		await animateActionIcon('error');
	}
});

// --- Keyboard shortcuts -----------------------------------------------------

browserApi.commands.onCommand.addListener(async command => {
	if (command === 'copy-selection-as-md') {
		try {
			const tabs = await browserApi.tabs.query({active: true, currentWindow: true});
			if (tabs.length === 0 || tabs[0].id === undefined) {
				return;
			}

			const message: ContentRequest = {
				type: 'copy-as-markdown',
				actionType: 'selection',
				htmlContent: '',
			};
			await copyInTab(tabs[0].id, message);
		} catch (error) {
			console.error('[markdown-clipboard]', error);
			await animateActionIcon('error');
		}
	} else if (command === 'convert-clipboard-as-md') {
		await convertClipboard();
	}
});

// --- Toolbar action: convert clipboard HTML to Markdown ---------------------

browserApi.action.onClicked.addListener(async () => {
	await convertClipboard();
});

async function convertClipboard(): Promise<void> {
	let result: ConversionResult;
	try {
		// `#convert-host` is aliased per target: Firefox converts in-page,
		// Chromium delegates to the offscreen document.
		result = await convertClipboardToMarkdown();
	} catch (error) {
		result = {outcome: 'error', message: String(error)};
	}

	if (result.outcome === 'error') {
		console.error('[markdown-clipboard] Conversion failed:', result.message);
	}

	await animateActionIcon(result.outcome);
}
