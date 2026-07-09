/** Message sent from the background to the content script of the active tab. */
export type ContentRequest = {
	type: 'copy-as-markdown';
	actionType: 'selection' | 'link' | 'image';
	htmlContent: string;
};

/** Message sent from the background to the offscreen document (Chromium only). */
export type OffscreenRequest = {
	type: 'convert-clipboard';
	target: 'offscreen';
};

export type ConversionOutcome = 'converted' | 'no-html' | 'error';

export type ConversionResult = {
	outcome: ConversionOutcome;
	/** Present on 'error' for logging purposes. */
	message?: string;
};

declare global {
	// Firefox provides the `browser` namespace; Chromium only `chrome`.
	// eslint-disable-next-line no-var
	var browser: typeof chrome | undefined;
}
