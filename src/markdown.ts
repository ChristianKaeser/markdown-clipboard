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
				.replace(/\n/gm, '\n    ') // Indent
				.replace(/^[ \t]+$/gm, ''); // Don't leave whitespace on blank lines (e.g. `<li><p>…`)

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

	// Turndown's built-in fenced-code rule only matches `<pre><code>`. Many
	// sources (MediaWiki `mw-highlight`, some docs sites) emit a bare `<pre>`
	// with no inner `<code>`; without this those blocks lose their fencing *and*
	// their internal blank lines (whitespace gets collapsed as normal text).
	turndownService.addRule('barePre', {
		filter: node => node.nodeName === 'PRE' && !node.querySelector('code'),
		replacement(_content, node) {
			const code = (node.textContent ?? '').replace(/\n+$/, '');
			// Fence must be longer than any backtick run inside the code.
			const longestRun = Math.max(0, ...[...code.matchAll(/`+/g)].map(match => match[0].length));
			const fence = '`'.repeat(Math.max(3, longestRun + 1));
			return `\n\n${fence}\n${code}\n${fence}\n\n`;
		},
	});

	// We convert every table ourselves instead of using turndown-plugin-gfm's
	// table rules, which (a) keep a table as raw HTML unless its first row is a
	// heading row by a strict definition (a `<colgroup>` before the `<tbody>`, as
	// ProseMirror/tiptap editors emit, already fails it), and (b) don't flatten
	// block content in cells, so `<td><p>…</p></td>` breaks the row across lines.
	// 2-column key/value layout tables (header column, no header row) become
	// label/value pairs; everything else becomes a GFM table with the first row
	// as the header.
	const isHeadingRow = (row: HTMLTableRowElement): boolean => {
		const parent = row.parentElement;
		if (!parent) {
			return false;
		}

		return parent.nodeName === 'THEAD'
			|| (parent.firstElementChild === row && [...row.cells].every(cell => cell.nodeName === 'TH'));
	};

	// Convert a cell's own content to inline Markdown (flattened to one line).
	const cellToInline = (cell: HTMLTableCellElement): string =>
		turndownService.turndown(cell.innerHTML).replaceAll(/\s*\n+\s*/g, ' ').trim();

	// In a GFM table cell, a literal `|` (even inside a code span) must be escaped.
	const tableCell = (cell: HTMLTableCellElement): string =>
		cellToInline(cell).replaceAll('|', String.raw`\|`);

	const separatorFor = (cell: HTMLTableCellElement | undefined): string => {
		const align = (cell?.getAttribute('align') ?? cell?.style.textAlign ?? '').toLowerCase();
		switch (align) {
			case 'left': {
				return ':---';
			}

			case 'center': {
				return ':---:';
			}

			case 'right': {
				return '---:';
			}

			default: {
				return '---';
			}
		}
	};

	turndownService.addRule('table', {
		filter: node => node.nodeName === 'TABLE' && (node as HTMLTableElement).rows.length > 0,
		replacement(_content, node) {
			const rows = [...(node as HTMLTableElement).rows];

			// Key/value layout table: no header row, every row is a `<th>` label +
			// one value cell.
			if (!isHeadingRow(rows[0])
				&& rows.every(row => row.cells.length === 2 && row.cells[0].nodeName === 'TH')) {
				const pairs = rows.map(row => `**${cellToInline(row.cells[0])}** — ${cellToInline(row.cells[1])}`);
				return '\n\n' + pairs.join('\n\n') + '\n\n';
			}

			// Otherwise: a GFM table, first row as the header.
			const width = Math.max(...rows.map(row => row.cells.length));
			const toLine = (row: HTMLTableRowElement): string => {
				const cells = [...row.cells].map(cell => tableCell(cell));
				while (cells.length < width) {
					cells.push('');
				}

				return `| ${cells.join(' | ')} |`;
			};

			const headerCells = [...rows[0].cells];
			const separator = `| ${Array.from({length: width}, (_, index) => separatorFor(headerCells[index])).join(' | ')} |`;
			return '\n\n' + [toLine(rows[0]), separator, ...rows.slice(1).map(row => toLine(row))].join('\n') + '\n\n';
		},
	});

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
