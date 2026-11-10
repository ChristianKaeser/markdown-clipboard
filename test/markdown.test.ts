import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {htmlToMarkdown} from '../src/markdown.js';

// Vitest runs with the project root as cwd
const claudeSnippet = readFileSync('test/fixtures/claude-snippet.html', 'utf8');

describe('htmlToMarkdown', () => {
	it('converts a real Chromium clipboard snippet (claude.ai) with inline code, bold, and italics', () => {
		const markdown = htmlToMarkdown(claudeSnippet);

		expect(markdown).toContain('**retirement**');
		expect(markdown).toContain('`partial_register_lane_work.md`');
		expect(markdown).toContain('_unblocked now_');
		expect(markdown).toContain('`--legacy-masks`');
		expect(markdown).toContain('`canonicalizeViewRegisters`');
		expect(markdown).toContain('`cppTestLegacy`');
		expect(markdown).toContain('_High value / medium effort / low risk._');
		expect(markdown).toContain('—');
	});

	it('normalizes non-breaking spaces to regular spaces', () => {
		const markdown = htmlToMarkdown(claudeSnippet);
		expect(markdown).not.toContain('\u00A0');
	});

	it('converts headings, links, and emphasis', () => {
		const markdown = htmlToMarkdown('<h2>Title</h2><p>See <a href="https://example.com/">docs</a> for <strong>more</strong>.</p>');
		expect(markdown).toBe('## Title\n\nSee [docs](https://example.com/) for **more**.');
	});

	it('converts ordered lists with start offsets', () => {
		const markdown = htmlToMarkdown('<ol start="3"><li>three</li><li>four</li></ol>');
		expect(markdown).toContain('3. three');
		expect(markdown).toContain('4. four');
	});

	it('converts tables via GFM', () => {
		const markdown = htmlToMarkdown('<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
		expect(markdown).toContain('| a | b |');
		expect(markdown).toContain('| 1 | 2 |');
	});

	it('renders a 2-column key/value (header-column) table as label/value pairs', () => {
		// turndown-plugin-gfm keeps these as raw HTML; we degrade them instead.
		const markdown = htmlToMarkdown('<table><tbody><tr><th>Summary</th><td>See your <a href="https://x.test/">tabs</a></td></tr><tr><th>Description</th><td>Based on <strong>Helper</strong></td></tr></tbody></table>');
		expect(markdown).toBe('**Summary** — See your [tabs](https://x.test/)\n\n**Description** — Based on **Helper**');
	});

	it('renders a header-less table as a GFM table with the first row as header', () => {
		const markdown = htmlToMarkdown('<table><tbody><tr><td>Ada</td><td>Engineer</td></tr><tr><td>Linus</td><td>Kernel</td></tr></tbody></table>');
		expect(markdown).toBe('| Ada | Engineer |\n| --- | --- |\n| Linus | Kernel |');
	});

	it('converts editor tables with a <colgroup> and <p>-wrapped cells (ProseMirror/tiptap)', () => {
		// The <colgroup> before <tbody> made turndown-plugin-gfm keep raw HTML,
		// and <p> in cells broke rows across lines.
		const markdown = htmlToMarkdown('<p>Intro.</p><table style="min-width: 96px;"><colgroup><col style="min-width: 48px;"><col style="min-width: 48px;"></colgroup><tbody>'
			+ '<tr><th colspan="1" rowspan="1"><p>Typology</p></th><th colspan="1" rowspan="1"><p>Parcel rule</p></th></tr>'
			+ '<tr><td colspan="1" rowspan="1"><p>Old town (Altstadt)</p></td><td colspan="1" rowspan="1"><p>Narrow, deep lots, 5–8 m frontage</p></td></tr>'
			+ '</tbody></table>');
		expect(markdown).toBe('Intro.\n\n| Typology | Parcel rule |\n| --- | --- |\n| Old town (Altstadt) | Narrow, deep lots, 5–8 m frontage |');
	});

	it('escapes pipes in table cells, including inside code spans', () => {
		const markdown = htmlToMarkdown('<table><thead><tr><th>op</th></tr></thead><tbody><tr><td>a | b</td></tr><tr><td><code>x || y</code></td></tr></tbody></table>');
		expect(markdown).toBe('| op |\n| --- |\n| a \\| b |\n| `x \\|\\| y` |');
	});

	it('keeps column alignment from the header cells', () => {
		const markdown = htmlToMarkdown('<table><thead><tr><th align="left">a</th><th style="text-align: center">b</th><th align="right">c</th><th>d</th></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></tbody></table>');
		expect(markdown).toContain('| :--- | :---: | ---: | --- |');
	});

	it('does not dump raw <table> HTML for unhandled tables', () => {
		const markdown = htmlToMarkdown('<table><tbody><tr><th>k</th><td>v</td></tr></tbody></table>');
		expect(markdown).not.toContain('<table');
		expect(markdown).not.toContain('<td');
	});

	it('converts fenced code blocks', () => {
		const markdown = htmlToMarkdown('<pre><code>const x = 1;\nconsole.log(x);</code></pre>');
		expect(markdown).toContain('```\nconst x = 1;\nconsole.log(x);\n```');
	});

	it('fences a bare <pre> (no inner <code>) and preserves its blank lines', () => {
		// MediaWiki `mw-highlight` and similar emit <pre> without a <code> child;
		// Turndown's built-in rule only fences <pre><code>.
		const markdown = htmlToMarkdown('<div class="mw-highlight"><pre>a: 1\n\nb: 2</pre></div>');
		expect(markdown).toContain('```\na: 1\n\nb: 2\n```');
	});

	it('widens the fence when a bare <pre> contains a triple-backtick run', () => {
		const markdown = htmlToMarkdown('<pre>before\n```\nafter</pre>');
		expect(markdown).toContain('````\nbefore\n```\nafter\n````');
	});

	it('leaves intraword underscores unescaped', () => {
		expect(htmlToMarkdown('<p>hir_high_variable_allocation</p>')).toBe('hir_high_variable_allocation');
		expect(htmlToMarkdown('<p>a__b</p>')).toBe('a__b');
		expect(htmlToMarkdown('<p>lane_1_of_2</p>')).toBe('lane_1_of_2');
	});

	it('still escapes underscores that could open or close emphasis', () => {
		expect(htmlToMarkdown('<p>_emphasis_</p>')).toBe('\\_emphasis\\_');
		expect(htmlToMarkdown('<p>__init__</p>')).toBe('\\_\\_init\\_\\_');
		expect(htmlToMarkdown('<p>ends_ _starts</p>')).toBe('ends\\_ \\_starts');
	});

	it('still escapes intraword asterisks, which do emphasize', () => {
		expect(htmlToMarkdown('<p>a*b*c</p>')).toBe('a\\*b\\*c');
	});

	it('does not unescape an underscore preceded by a literal backslash', () => {
		expect(htmlToMarkdown(String.raw`<p>a\_b</p>`)).toBe(String.raw`a\\\_b`);
	});

	it('leaves underscores in code spans alone', () => {
		expect(htmlToMarkdown('<p><code>_foo_</code></p>')).toBe('`_foo_`');
	});

	it('does not leave whitespace-only lines between paragraph-wrapped list items', () => {
		// Claude Code Desktop emits `<li><p>…</p></li>`; the paragraph wrapping
		// used to leave a line of 4 spaces between each item.
		const markdown = htmlToMarkdown('<ul data-pm-slice="0 0 []"><li><p>s</p></li><li><p>sd</p></li><li><p>x</p></li></ul><p></p>');
		expect(markdown).toBe('- s\n- sd\n- x');
		expect(markdown.split('\n').some(line => /^[ \t]+$/.test(line))).toBe(false);
	});

	it('keeps continuation lines indented but blank lines empty in loose list items', () => {
		const markdown = htmlToMarkdown('<ul><li><p>first</p><p>second</p></li><li><p>next</p></li></ul>');
		expect(markdown).toBe('- first\n\n    second\n- next');
		expect(markdown.split('\n').some(line => /^[ \t]+$/.test(line))).toBe(false);
	});

	it('strips style tags entirely', () => {
		const markdown = htmlToMarkdown('<style>.a { color: red; }</style><p>text</p>');
		expect(markdown).toBe('text');
	});
});
