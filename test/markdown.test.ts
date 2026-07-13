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
