import type {ConversionOutcome} from './protocol.js';

/**
 * Plays a short animation on the toolbar icon: a circular sweep that resolves
 * into a checkmark (success), a dash (no HTML on the clipboard), or a cross
 * (error). Drawn with OffscreenCanvas, which is available both in Chromium
 * service workers and Firefox background event pages.
 */

const SIZES = [16, 32] as const;
const FRAME_COUNT = 12;
const FRAME_DURATION_MS = 40;
const HOLD_DURATION_MS = 1100;

const COLORS: Record<ConversionOutcome, string> = {
	converted: '#1a7f37', // Green
	'no-html': '#9a6700', // Amber
	error: '#cf222e', // Red
};

const browserApi = globalThis.browser ?? globalThis.chrome;

let animationToken = 0;

export async function animateActionIcon(outcome: ConversionOutcome): Promise<void> {
	const token = ++animationToken;

	if (typeof OffscreenCanvas === 'undefined') {
		await animateBadgeFallback(outcome, token);
		return;
	}

	for (let frame = 1; frame <= FRAME_COUNT; frame++) {
		if (token !== animationToken) {
			return; // A newer animation took over
		}

		await setIconFrame(outcome, frame / FRAME_COUNT);
		await delay(FRAME_DURATION_MS);
	}

	await delay(HOLD_DURATION_MS);
	if (token === animationToken) {
		await resetIcon();
	}
}

async function setIconFrame(outcome: ConversionOutcome, progress: number): Promise<void> {
	const imageData: Record<number, ImageData> = {};
	for (const size of SIZES) {
		imageData[size] = drawFrame(size, outcome, progress);
	}

	await browserApi.action.setIcon({imageData});
}

function drawFrame(size: number, outcome: ConversionOutcome, progress: number): ImageData {
	const canvas = new OffscreenCanvas(size, size);
	const context = canvas.getContext('2d')!;
	const center = size / 2;
	const radius = size * 0.44;
	context.lineCap = 'round';
	context.strokeStyle = COLORS[outcome];

	// Phase 1 (0..0.5): circle sweep. Phase 2 (0.5..1): draw the glyph inside.
	const sweep = Math.min(progress * 2, 1);
	context.lineWidth = Math.max(size * 0.09, 1.5);
	context.beginPath();
	context.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + (sweep * 2 * Math.PI));
	context.stroke();

	const glyph = Math.max((progress - 0.5) * 2, 0);
	if (glyph > 0) {
		context.lineWidth = Math.max(size * 0.11, 2);
		context.beginPath();
		switch (outcome) {
			case 'converted': {
				// Checkmark: two segments, revealed progressively
				const points: Array<[number, number]> = [
					[0.30, 0.52],
					[0.45, 0.68],
					[0.72, 0.34],
				];
				tracePolyline(context, size, points, glyph);
				break;
			}

			case 'no-html': {
				// Horizontal dash, growing from the center
				const half = 0.20 * glyph;
				context.moveTo(size * (0.5 - half), center);
				context.lineTo(size * (0.5 + half), center);
				break;
			}

			case 'error': {
				// Cross: two strokes
				tracePolyline(context, size, [[0.34, 0.34], [0.66, 0.66]], Math.min(glyph * 2, 1));
				const second = Math.max(glyph * 2 - 1, 0);
				if (second > 0) {
					tracePolyline(context, size, [[0.66, 0.34], [0.34, 0.66]], second);
				}

				break;
			}
		}

		context.stroke();
	}

	return context.getImageData(0, 0, size, size);
}

/** Adds a partially revealed polyline (relative coordinates) to the current path. */
function tracePolyline(
	context: OffscreenCanvasRenderingContext2D,
	size: number,
	points: Array<[number, number]>,
	progress: number,
): void {
	const lengths: number[] = [];
	let total = 0;
	for (let index = 1; index < points.length; index++) {
		const dx = points[index][0] - points[index - 1][0];
		const dy = points[index][1] - points[index - 1][1];
		const length = Math.hypot(dx, dy);
		lengths.push(length);
		total += length;
	}

	let remaining = total * progress;
	context.moveTo(points[0][0] * size, points[0][1] * size);
	for (let index = 1; index < points.length && remaining > 0; index++) {
		const segment = lengths[index - 1];
		const ratio = Math.min(remaining / segment, 1);
		const x = points[index - 1][0] + ((points[index][0] - points[index - 1][0]) * ratio);
		const y = points[index - 1][1] + ((points[index][1] - points[index - 1][1]) * ratio);
		context.lineTo(x * size, y * size);
		remaining -= segment;
	}
}

async function animateBadgeFallback(outcome: ConversionOutcome, token: number): Promise<void> {
	const badgeText: Record<ConversionOutcome, string> = {
		converted: '✓',
		'no-html': '–',
		error: '✗',
	};

	await browserApi.action.setBadgeBackgroundColor({color: COLORS[outcome]});
	await browserApi.action.setBadgeText({text: badgeText[outcome]});
	await delay(FRAME_COUNT * FRAME_DURATION_MS + HOLD_DURATION_MS);
	if (token === animationToken) {
		await browserApi.action.setBadgeText({text: ''});
	}
}

async function resetIcon(): Promise<void> {
	await browserApi.action.setIcon({
		path: {
			16: 'icons/icon-16.png',
			32: 'icons/icon-32.png',
		},
	});
}

async function delay(milliseconds: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, milliseconds);
	});
}
