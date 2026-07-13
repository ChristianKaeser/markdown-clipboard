import {cp, mkdir, writeFile} from 'node:fs/promises';
import process from 'node:process';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const requestedTargets = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
const targets = requestedTargets.length > 0 ? requestedTargets : ['chrome', 'firefox'];

const baseManifest = {
	name: 'Markdown Clipboard',
	version: '0.1.1',
	description: 'Convert HTML on your clipboard or on a page to Markdown with one click. Formats lists, links, images, and selections.',
	manifest_version: 3,
	icons: {
		16: 'icons/icon-16.png',
		32: 'icons/icon-32.png',
		48: 'icons/icon-48.png',
		128: 'icons/icon-128.png',
	},
	action: {
		default_icon: {
			16: 'icons/icon-16.png',
			32: 'icons/icon-32.png',
		},
		default_title: 'Convert clipboard HTML to Markdown',
	},
	content_scripts: [
		{
			matches: ['*://*/*'],
			js: ['content.js'],
			run_at: 'document_idle',
		},
	],
	commands: {
		'copy-selection-as-md': {
			suggested_key: {default: 'Alt+X'},
			description: 'Copy selection as Markdown',
		},
		'convert-clipboard-as-md': {
			suggested_key: {default: 'Alt+Shift+X'},
			description: 'Convert clipboard HTML to Markdown',
		},
	},
};

function manifestFor(target) {
	if (target === 'chrome') {
		return {
			...baseManifest,
			minimum_chrome_version: '116',
			permissions: ['contextMenus', 'activeTab', 'clipboardRead', 'clipboardWrite', 'offscreen'],
			background: {service_worker: 'background.js'},
		};
	}

	return {
		...baseManifest,
		permissions: ['contextMenus', 'activeTab', 'clipboardRead', 'clipboardWrite'],
		background: {scripts: ['background.js']},
		browser_specific_settings: {
			gecko: {
				id: 'markdown-clipboard@ckaeser.de',
				// `data_collection_permissions` (required by AMO for new
				// submissions) was introduced in Firefox 140, which is also the
				// current ESR baseline.
				strict_min_version: '140.0',
				// Everything happens locally on the clipboard; nothing is
				// transmitted, so we declare the special "none" value.
				data_collection_permissions: {
					required: ['none'],
				},
			},
			// Firefox for Android gained the data-collection key one release
			// later than desktop.
			gecko_android: {
				strict_min_version: '142.0',
			},
		},
	};
}

async function buildTarget(target) {
	const outdir = `dist/${target}`;
	await mkdir(`${outdir}/icons`, {recursive: true});

	const entryPoints = ['src/background.ts', 'src/content.ts'];
	if (target === 'chrome') {
		entryPoints.push('src/offscreen.ts');
	}

	const buildOptions = {
		entryPoints,
		bundle: true,
		format: 'iife',
		outdir,
		sourcemap: false,
		minify: false,
		logLevel: 'info',
		alias: {
			// The Chromium service worker delegates clipboard work to the
			// offscreen document (no DOM/Turndown in the worker); Firefox's
			// background page converts directly.
			'#convert-host': target === 'chrome'
				? './src/convert-host-chrome.ts'
				: './src/clipboard-convert.ts',
		},
	};

	await writeFile(`${outdir}/manifest.json`, JSON.stringify(manifestFor(target), null, '\t'));
	await cp('icons', `${outdir}/icons`, {recursive: true});
	if (target === 'chrome') {
		await cp('src/offscreen.html', `${outdir}/offscreen.html`);
	}

	if (watch) {
		const context = await esbuild.context(buildOptions);
		await context.watch();
	} else {
		await esbuild.build(buildOptions);
	}
}

await Promise.all(targets.map(target => buildTarget(target)));
if (watch) {
	console.log(`Watching for changes (${targets.join(', ')})…`);
}
