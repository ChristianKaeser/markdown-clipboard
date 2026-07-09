import {htmlToMarkdown} from './markdown.js';
import type {ContentRequest} from './protocol.js';

// Chrome does not expose the `browser` namespace yet.
const browserApi = globalThis.browser ?? globalThis.chrome;

function getSelectionAsHTML(): string {
	const selection = document.getSelection();
	let containerTagName = '';

	if (!selection || selection.rangeCount === 0) {
		return '';
	}

	const selectionRange = selection.getRangeAt(0); // Only consider the first range
	const container = selectionRange.commonAncestorContainer;

	// All of the text in the container element is selected, then use the parent's tag
	if (selectionRange.toString().trim() === container.textContent?.trim()) {
		// Handle plain text selections where the parent is sometimes 'Node' or 'DocumentFragment'.
		// Ideally, this should not happen, but text selection in browsers is unpredictable.
		containerTagName = container instanceof Element
			? container.tagName.toLowerCase()
			: 'p';
	}

	const fragment = selectionRange.cloneContents();
	const wrapper = document.createElement('div');
	wrapper.append(fragment);

	// Convert relative links to absolute links
	for (const link of wrapper.querySelectorAll('a')) {
		link.setAttribute('href', link.href);
	}

	// For tables, remove all immediate child nodes that are not required
	for (const table of wrapper.querySelectorAll('table')) {
		const floaters = [...table.children].filter(node => !['THEAD', 'TBODY', 'TR', 'TFOOT'].includes(node.tagName));
		for (const floater of floaters) {
			floater.remove();
		}
	}

	if (containerTagName === '') {
		return wrapper.innerHTML;
	}

	// For preformatted tags, content needs to be wrapped inside `<code>`
	// or it would not be considered as a fenced code block
	if (containerTagName === 'pre') {
		// Classes of the parent or container node can be used by the GFM plugin to detect the language
		const classes = ((container.parentNode ?? container) as Element).classList.toString();

		return `
			<div class="${classes}">
				<pre><code>${wrapper.innerHTML}</code></pre>
			</div>
		`;
	}

	return `<${containerTagName}>${wrapper.innerHTML}</${containerTagName}>`;
}

browserApi.runtime.onMessage.addListener((message: ContentRequest) => {
	if (message.type !== 'copy-as-markdown') {
		return;
	}

	const htmlContent = message.actionType === 'selection'
		? getSelectionAsHTML()
		: message.htmlContent;

	(async () => {
		try {
			const markdownContent = htmlToMarkdown(htmlContent);
			await navigator.clipboard.writeText(markdownContent);
		} catch (error) {
			console.error('[markdown-clipboard]', error);
		}
	})();
});
