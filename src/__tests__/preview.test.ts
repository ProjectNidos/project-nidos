import { describe, it, expect } from 'vitest';
import { parsePreviewMessage, PREVIEW_TAG } from '@/lib/preview';

const parent = {};
const expected = { origin: 'https://site.test', source: parent };
const msg = (data: unknown, over: Partial<{ origin: string; source: unknown }> = {}) =>
  parsePreviewMessage({ origin: expected.origin, source: parent, data, ...over }, expected);
const text = (key: string, value: unknown) => ({ tag: PREVIEW_TAG, type: 'text', key, value });

describe('parsePreviewMessage', () => {
  it('accepts a text message for an editable key', () => {
    expect(msg(text('hero.title', 'Jauns'))).toEqual(text('hero.title', 'Jauns'));
  });
  it('accepts focus and ready', () => {
    expect(msg({ tag: PREVIEW_TAG, type: 'focus', key: 'about.text' })).toEqual({ tag: PREVIEW_TAG, type: 'focus', key: 'about.text' });
    expect(msg({ tag: PREVIEW_TAG, type: 'ready' })).toEqual({ tag: PREVIEW_TAG, type: 'ready' });
  });
  it('ignores another origin', () => {
    expect(msg(text('hero.title', 'x'), { origin: 'https://evil.test' })).toBeNull();
  });
  it('ignores a window other than the expected one', () => {
    expect(msg(text('hero.title', 'x'), { source: {} })).toBeNull();
  });
  it('ignores keys the admin cannot edit', () => {
    expect(msg(text('meta.title', 'x'))).toBeNull();
    expect(msg({ tag: PREVIEW_TAG, type: 'focus', key: 'meta.title' })).toBeNull();
  });
  it('ignores values over the save limit and non-strings', () => {
    expect(msg(text('hero.title', 'a'.repeat(2001)))).toBeNull();
    expect(msg(text('hero.title', 42))).toBeNull();
  });
  it('ignores other tags, unknown types and junk', () => {
    expect(msg({ ...text('hero.title', 'x'), tag: 'other' })).toBeNull();
    expect(msg({ tag: PREVIEW_TAG, type: 'eval', key: 'hero.title' })).toBeNull();
    expect(msg('hello')).toBeNull();
    expect(msg(null)).toBeNull();
  });
  it('passes markup through unchanged: the bridge shows it as text', () => {
    expect(msg(text('hero.title', '<b>x</b>'))).toEqual(text('hero.title', '<b>x</b>'));
  });
});
