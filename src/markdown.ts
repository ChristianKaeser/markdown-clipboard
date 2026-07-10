import TurndownService from 'turndown';
// @ts-expect-error -- no type declarations published for this plugin
import {gfm} from 'turndown-plugin-gfm';
import {MathMLToLaTeX} from 'mathml-to-latex';

export function createTurndownService(): TurndownService {
	const turndownService = new TurndownService({
		hr: '---',
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced',
	});
	turndownService.keep(['kbd', 'sup', 'sub']); // HTML content to retain in Markdown
	turndownService.remove(['script', 'style']);
	turndownService.use(gfm);

	// Workaround for https://github.com/domchristie/turndown/issues/291
	// (list items nested content indentation and ordered list numbering)
	turndownService.addRule('listItem', {
		filter: 'li',
		replacement(content, node, options) {
			content = content
				.replace(/^\n+/, '') // Remove leading newlines
				.replace(/\n+$/, '\n') // Replace trailing newlines with just a single one
				.replace(/\n/gm, '\n    '); // Indent

			let prefix = options.bulletListMarker + ' ';
			const parent = node.parentNode as HTMLElement;
			if (parent.nodeName === 'OL') {
				const start = parent.getAttribute('start');
				const index = Array.prototype.indexOf.call(parent.children, node);
				prefix = (start ? Number(start) + index : index + 1) + '. ';
			}

			return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
		},
	});

	// Turndown escapes every `_`. An underscore flanked by word characters can
	// never open or close emphasis (CommonMark, GFM, Pandoc, markdown-it), so
	// those escapes only mangle identifiers like `hir_high_variable_allocation`.
	// Asterisks are not equivalent: `a*b*c` really does emphasize, so `\*` stays.
	// `[^\W_]` is "word character, but not underscore": a run must be flanked by
	// letters or digits, so neither a neighbouring escape (`\_\_init\_\_`) nor a
	// literal backslash (`a\\\_b`) can be mistaken for the flanking character.
	const escape = turndownService.escape.bind(turndownService);
	turndownService.escape = (text: string) =>
		escape(text).replaceAll(/(?<=[^\W_])(?:\\_)+(?=[^\W_])/g, match => match.replaceAll('\\', ''));

	turndownService.addRule('mathml', {
		// 'math' is not part of HTMLElementTagNameMap, so match by node name
		filter: node => node.nodeName.toLowerCase() === 'math',
		replacement(_content, node) {
			const latex = MathMLToLaTeX.convert((node as HTMLElement).outerHTML);
			if (!latex) {
				return '';
			}

			const delimiter = (node as HTMLElement).getAttribute('display') === 'block' ? '$$' : '$';
			return delimiter + latex + delimiter;
		},
	});

	return turndownService;
}

let sharedService: TurndownService | undefined;

/**
 * Convert an HTML fragment (e.g. the `text/html` clipboard flavor) to Markdown.
 * Requires a DOM (document) in the current context.
 */
export function htmlToMarkdown(html: string): string {
	sharedService ??= createTurndownService();
	// Rich-text sources are littered with non-breaking spaces; normalize them
	// outside of code so the Markdown stays editable.
	return sharedService.turndown(html).replaceAll('\u00A0', ' ');
}
