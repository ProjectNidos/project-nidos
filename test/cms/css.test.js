const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseCss, scopeCss } = require('../../server/cms/css');

test('reads rules, selector lists and one level of @media', () => {
  assert.deepEqual(parseCss(`
    /* a comment, { with braces } */
    .a, .b > .c { color: red; margin: 0 auto }
    @media (max-width: 720px) {
      .field :is(input, select) { outline: none; }
    }
  `), [
    { at: null, selectors: ['.a', '.b > .c'], decls: ['color: red', 'margin: 0 auto'] },
    { at: '@media (max-width: 720px)', selectors: ['.field :is(input, select)'], decls: ['outline: none'] },
  ]);
});

test('scopes every selector to the block, and "&" to its own element', () => {
  assert.equal(scopeCss(`
    &.hero { position: relative; }
    .hero-title, &.hero:hover .x::before { color: red; }
    @media (max-width: 720px) { &.hero { min-height: 0; } .a { b: c; } }
    & { --t: 1; }
  `, 'hero'), [
    ':where(.b-hero).hero { position: relative; }',
    ':where(.b-hero) .hero-title, :where(.b-hero).hero:hover .x::before { color: red; }',
    '@media (max-width: 720px) {',
    ':where(.b-hero).hero { min-height: 0; }',
    ':where(.b-hero) .a { b: c; }',
    '}',
    ':where(.b-hero) { --t: 1; }',
    '',
  ].join('\n'));
});

test('an empty sheet scopes to nothing', () => assert.equal(scopeCss('', 'text'), ''));

test('refuses what it cannot scope safely', () => {
  for (const [css, why] of [
    ['html .x { a: b; }', /reaches outside the block/],
    [':root { --a: 1; }', /reaches outside the block/],
    ['.a & .b { a: b; }', /"&" starts a selector/],
    ['&section { a: b; }', /"&" starts a selector/],
    ['.b-hero .x { a: b; }', /names a block class/],
    ['@keyframes k { from { a: b; } }', /not supported/],
    ['@media (x) { @media (y) { .a { b: c; } } }', /not supported/],
    ['.a { .b { c: d; } }', /nested rules/],
    ['.a { b: c;', /never closed/],
    ['.a { b: c; } }', /outside any rule/],
    ['.a { b: c; } } .d { e: f; }', /cannot read/],
    ['BODY .x { a: b; }', /reaches outside the block/],
    ['& + .x { a: b; }', /reaches a sibling/],
    ['&.hero ~ section { a: b; }', /reaches a sibling/],
    ['+ .x { a: b; }', /reaches a sibling/],
    ['.a { background: url("x;y"); }', /holds a ";"/],
    ['.a { background: url(x;y); }', /holds a ";"/],
  ]) assert.throws(() => scopeCss(css, 'hero'), why, css);
});

test('combinators inside the block stay allowed', () => {
  assert.equal(scopeCss('.a + .b { c: d; }\n&.hero > .x { c: d; }', 'hero'),
    ':where(.b-hero) .a + .b { c: d; }\n:where(.b-hero).hero > .x { c: d; }\n');
});

test("reads the site's legacy sheets without complaint", () => {
  for (const f of ['landing.css', 'pages.css', 'shared.css']) {
    assert.ok(parseCss(fs.readFileSync(path.join(__dirname, '../..', f), 'utf8')).length > 20, f);
  }
});
