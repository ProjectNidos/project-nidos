const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProps } = require('../../server/cms/fields');

const F = {
  title: { type: 'text', label: 'Title', max: 10, required: true },
  body: { type: 'richtext', label: 'Body', max: 50, profile: 'inline' },
  kind: { type: 'select', label: 'Kind', options: ['a', 'b'] },
  link: { type: 'link', label: 'Link' },
  anchor: { type: 'anchor', label: 'Anchor' },
  day: { type: 'date', label: 'Day' },
  items: { type: 'list', label: 'Items', min: 1, max: 2, of: { t: { type: 'text', label: 'T', max: 3, required: true } } },
  tags: { type: 'list', label: 'Tags', min: 0, max: 3, itemMax: 4, of: 'string' },
  btn: { type: 'group', label: 'Button', required: true, of: { label: { type: 'text', label: 'L', max: 5, required: true } } },
};
const ok = { title: 'Hi', body: 'x', kind: 'a', link: '/p', anchor: 'about', day: '2026-09-23', items: [{ t: 'abc' }], tags: ['ab'], btn: { label: 'Go' } };

test('valid props pass', () => assert.deepEqual(validateProps(F, ok), []));
test('required and max', () => {
  const e = validateProps(F, { ...ok, title: '', items: [{ t: 'abcd' }] });
  assert.deepEqual(e.map((x) => x.path), ['title', 'items[0].t']);
});
test('select, link, anchor', () => {
  const e = validateProps(F, { ...ok, kind: 'z', link: 'javascript:x', anchor: 'Bad Anchor' });
  assert.deepEqual(e.map((x) => x.path), ['kind', 'link', 'anchor']);
});
test('dates are real YYYY-MM-DD days', () => {
  assert.deepEqual(validateProps(F, { ...ok, day: '23 Sep 2026' }).map((x) => x.path), ['day']);
  assert.deepEqual(validateProps(F, { ...ok, day: '2026-02-30' }).map((x) => x.path), ['day']);
});
test('list bounds, string lists, groups', () => {
  assert.deepEqual(validateProps(F, { ...ok, items: [] }).map((x) => x.path), ['items']);
  assert.deepEqual(validateProps(F, { ...ok, tags: ['ab', 'toolong', 3] }).map((x) => x.path), ['tags[1]', 'tags[2]']);
  assert.deepEqual(validateProps(F, { ...ok, btn: { label: '' } }).map((x) => x.path), ['btn.label']);
  assert.deepEqual(validateProps(F, { ...ok, btn: null }).map((x) => x.path), ['btn']);
});
test('rich text length is measured on text, not markup', () => {
  assert.deepEqual(validateProps(F, { ...ok, body: '<strong>' + 'a'.repeat(50) + '</strong>' }), []);
  assert.deepEqual(validateProps(F, { ...ok, body: 'a'.repeat(51) }).map((x) => x.path), ['body']);
});
test('unknown props are rejected', () => {
  assert.deepEqual(validateProps(F, { ...ok, extra: 1 }).map((x) => x.path), ['extra']);
});
