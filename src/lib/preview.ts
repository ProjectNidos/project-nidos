import { EDITABLE_KEYS, MAX_TEXT } from './texts';

/**
 * Messages between the admin text editor and the site page it frames as a live
 * preview. Both ends run this check, so neither acts on another window's message.
 */
export const PREVIEW_TAG = 'nidos-preview';
/** Window event from the bridge: show (true) or hide the contact form's thank-you box. */
export const THANKS_EVENT = 'nidos-preview-thanks';

export type PreviewMsg =
  | { tag: typeof PREVIEW_TAG; type: 'text'; key: string; value: string }
  | { tag: typeof PREVIEW_TAG; type: 'focus'; key: string }
  | { tag: typeof PREVIEW_TAG; type: 'ready' };

const KEYS = new Set(EDITABLE_KEYS);

export function parsePreviewMessage(
  e: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown },
): PreviewMsg | null {
  if (e.origin !== expected.origin || !e.source || e.source !== expected.source) return null;
  const d = e.data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || d.tag !== PREVIEW_TAG) return null;
  if (d.type === 'ready') return { tag: PREVIEW_TAG, type: 'ready' };
  if (typeof d.key !== 'string' || !KEYS.has(d.key)) return null;
  if (d.type === 'focus') return { tag: PREVIEW_TAG, type: 'focus', key: d.key };
  if (d.type === 'text' && typeof d.value === 'string' && d.value.length <= MAX_TEXT)
    return { tag: PREVIEW_TAG, type: 'text', key: d.key, value: d.value };
  return null;
}
