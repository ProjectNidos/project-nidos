const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePage } = require('../../server/cms/validate');

const reg = {
  hero: { type: 'hero', label: 'Hero', layouts: ['home'], maxPerPage: 1, fields: { t: { type: 'text', label: 'T', max: 5, required: true } } },
  text: { type: 'text', label: 'Text', layouts: ['home', 'standard'], fields: {} },
};
const get = (t) => reg[t];

test('accepts a valid page', () => {
  assert.deepEqual(validatePage('home', [{ id: 'a', type: 'hero', props: { t: 'x' } }], get), []);
});
test('unknown type and wrong layout', () => {
  const e = validatePage('standard', [
    { id: 'a', type: 'nope', props: {} },
    { id: 'b', type: 'hero', props: { t: 'x' } },
  ], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[0]', 'blocks[1]']);
});
test('max per page, then the block\'s own field errors', () => {
  const e = validatePage('home', [
    { id: 'a', type: 'hero', props: { t: 'x' } },
    { id: 'b', type: 'hero', props: { t: 'toolong' } },
  ], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[1]', 'blocks[1].t']);
});
test('block ids must be unique', () => {
  const e = validatePage('home', [{ id: 'a', type: 'text', props: {} }, { id: 'a', type: 'text', props: {} }], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[1].id']);
});
test('a page is a list', () => {
  assert.deepEqual(validatePage('home', null, get).map((x) => x.path), ['blocks']);
});
