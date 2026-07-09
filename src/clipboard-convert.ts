import {htmlToMarkdown} from './markdown.js';
import type {ConversionResult} from './protocol.js';

/**
 * Reads the clipboard, converts its `text/html` flavor to Markdown, and
 * writes the Markdown back as `text/plain` while re-writing the original
 * HTML flavor so rich-text targets keep working.
 *
 * Must run in a context that has a DOM and the `clipboardRead` /
 * `clipboardWrite` permissions: the offscreen document on Chromium, or the
 * background event page on Firefox.
 */
export async function convertClipboardToMarkdown(): Promise<ConversionResult> {
	try {
		const {html} = await readClipboard();
		if (!html) {
			return {outcome: 'no-html'};
		}

		const markdown = htmlToMarkdown(html);
		await writeClipboard(markdown, html);
		return {outcome: 'converted'};
	} catch (error) {
		return {outcome: 'error', message: String(error)};
	}
}

type ClipboardFlavors = {
	html: string;
	text: string;
};

async function readClipboard(): Promise<ClipboardFlavors> {
	// Preferred path: async Clipboard API. Works in the Firefox background
	// page; throws in Chromium's offscreen document (never focused).
	try {
		const items = await navigator.clipboard.read();
		const flavors: ClipboardFlavors = {html: '', text: ''};
		for (const item of items) {
			if (item.types.includes('text/html')) {
				flavors.html = await (await item.getType('text/html')).text();
			}

			if (item.types.includes('text/plain')) {
				flavors.text = await (await item.getType('text/plain')).text();
			}
		}

		return flavors;
	} catch {
		return readClipboardViaExecCommand();
	}
}

function readClipboardViaExecCommand(): ClipboardFlavors {
	const flavors: ClipboardFlavors = {html: '', text: ''};

	const target = document.createElement('div');
	target.contentEditable = 'true';
	document.body.append(target);
	target.focus();

	const onPaste = (event: ClipboardEvent) => {
		flavors.html = event.clipboardData?.getData('text/html') ?? '';
		flavors.text = event.clipboardData?.getData('text/plain') ?? '';
		event.preventDefault();
	};

	document.addEventListener('paste', onPaste);
	try {
		document.execCommand('paste');
	} finally {
		document.removeEventListener('paste', onPaste);
		target.remove();
	}

	return flavors;
}

async function writeClipboard(markdown: string, html: string): Promise<void> {
	// Preferred path: async Clipboard API with both flavors.
	try {
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/plain': new Blob([markdown], {type: 'text/plain'}),
				'text/html': new Blob([html], {type: 'text/html'}),
			}),
		]);
		return;
	} catch {
		writeClipboardViaExecCommand(markdown, html);
	}
}

function writeClipboardViaExecCommand(markdown: string, html: string): void {
	// `execCommand('copy')` needs an active selection to fire the copy event.
	const target = document.createElement('textarea');
	target.value = ' ';
	document.body.append(target);
	target.select();

	const onCopy = (event: ClipboardEvent) => {
		event.clipboardData?.setData('text/plain', markdown);
		event.clipboardData?.setData('text/html', html);
		event.preventDefault();
	};

	document.addEventListener('copy', onCopy);
	try {
		if (!document.execCommand('copy')) {
			throw new Error('execCommand("copy") was rejected');
		}
	} finally {
		document.removeEventListener('copy', onCopy);
		target.remove();
	}
}
