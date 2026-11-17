'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { parsePreviewMessage, PREVIEW_TAG, THANKS_EVENT } from '@/lib/preview';

/**
 * Live preview for the admin text editor. Does nothing unless this page is
 * framed by our own site; then it swaps the text of `[data-k]` elements as the
 * admin types. Text only: values go in as textContent, never as HTML.
 */
export default function PreviewBridge() {
  // Navigating inside the preview re-runs this, so the admin re-sends the unsaved edits.
  const pathname = usePathname();
  useEffect(() => {
    if (window.parent === window) return;
    let marked: HTMLElement | null = null;
    // Unsaved edits, re-applied whenever React re-renders a part (thank-you box, form).
    const drafts = new Map<string, string>();
    const find = (key: string) => document.querySelectorAll<HTMLElement>(`[data-k="${CSS.escape(key)}"]`);
    const apply = (key: string) => find(key).forEach((el) => (el.textContent = drafts.get(key) ?? el.textContent));

    const show = (key: string) => {
      const el = [...find(key)].find((e) => e.getClientRects().length) ?? find(key)[0];
      if (!el) return;
      // A service's copy sits in the carousel's tab panel: open the matching tab first.
      const panel = el.closest('[role="tabpanel"]');
      if (panel) {
        const index = [...panel.children].findIndex((c) => c.contains(el));
        const tabs = document.querySelectorAll<HTMLElement>(`[aria-controls="${CSS.escape(panel.id)}"]`);
        tabs[index]?.click();
      }
      if (marked) marked.style.outline = marked.style.boxShadow = '';
      // Ink line with a paper halo: visible on the dark hero video and on paper.
      el.style.outline = '2px solid var(--color-ink)';
      el.style.outlineOffset = '4px';
      el.style.boxShadow = '0 0 0 4px var(--color-paper)';
      marked = el;
      // Scroll this page only: scrollIntoView would also scroll the admin page around the frame.
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: 'smooth' });
    };

    const onMessage = (e: MessageEvent) => {
      const msg = parsePreviewMessage(e, { origin: location.origin, source: window.parent });
      if (!msg || msg.type === 'ready') return;
      if (msg.type === 'text') {
        drafts.set(msg.key, msg.value);
        apply(msg.key);
        return;
      }
      window.dispatchEvent(new CustomEvent(THANKS_EVENT, { detail: msg.key === 'contact.success' }));
      // The thank-you box or the form renders on the next frame; then restore edits and scroll.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          drafts.forEach((_, key) => apply(key));
          show(msg.key);
        }),
      );
    };

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ tag: PREVIEW_TAG, type: 'ready' }, location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [pathname]);
  return null;
}
