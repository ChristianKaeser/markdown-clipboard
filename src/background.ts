import {animateActionIcon} from './icon-animation.js';
// Resolved per build target: the real converter on Firefox (the background
// event page has a DOM), a throwing stub on Chromium (delegates to offscreen).
import {convertClipboardToMarkdown} from '#convert-host';
import type {ContentRequest, ConversionResult, OffscreenRequest} from './protocol.js';

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
		});
	}
}

// Menus must be (re-)registered when the extension is installed or updated,
// and on browser startup for Firefox event pages.
browserApi.runtime.onInstalled.addListener(registerContextMenus);
browserApi.runtime.onStartup.addListener(registerContextMenus);

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
		await browserApi.tabs.sendMessage(tab.id, message);
	} catch (error) {
		console.error('[markdown-clipboard]', error);
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
			await browserApi.tabs.sendMessage(tabs[0].id, message);
		} catch (error) {
			console.error('[markdown-clipboard]', error);
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
		// Chromium: service workers have no DOM/clipboard, so delegate to an
		// offscreen document. Firefox: the background event page has both.
		result = chrome.offscreen
			? await convertViaOffscreenDocument()
			: await convertClipboardToMarkdown();
	} catch (error) {
		result = {outcome: 'error', message: String(error)};
	}

	if (result.outcome === 'error') {
		console.error('[markdown-clipboard] Conversion failed:', result.message);
	}

	await animateActionIcon(result.outcome);
}

async function convertViaOffscreenDocument(): Promise<ConversionResult> {
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
