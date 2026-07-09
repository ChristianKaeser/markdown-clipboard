import type {ConversionResult} from './protocol.js';

/**
 * Build-time stand-in for `clipboard-convert.ts` in the Chromium background
 * bundle: the service worker always delegates to the offscreen document, so
 * bundling Turndown there would only bloat worker startup. See build.mjs.
 */
export async function convertClipboardToMarkdown(): Promise<ConversionResult> {
	throw new Error('Direct clipboard conversion is not available in the service worker');
}
