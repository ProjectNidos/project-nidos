const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHtml, bodyOf, sectionOf } = require('./html');

test('drops comments and data-cms, collapses whitespace', () => {
  const a = '<body><!-- x --><h1 data-cms="t">Hi</h1>\n   <p>a   b</p></body>';
  assert.equal(normalizeHtml(a), '<h1>Hi</h1><p>a b</p>');
});

test('sorts attributes and class tokens', () => {
  const a = '<body><a href="/" class="hit-44 back-link">x</a></body>';
  const b = '<body><a class="back-link hit-44" href="/">x</a></body>';
  assert.equal(normalizeHtml(a), normalizeHtml(b));
});

test('resolves relative urls against the page path', () => {
  const a = '<body><script src="../topology-bg.js?v=1"></script></body>';
  assert.equal(normalizeHtml(a, '/nidos/x.html'), '<script src="/topology-bg.js?v=1"></script>');
});

test('leaves fragments, mailto and absolute urls alone', () => {
  const a = '<body><a href="#c">1</a><a href="mailto:a@b.c">2</a><a href="https://x.y/z">3</a></body>';
  assert.equal(normalizeHtml(a), '<a href="#c">1</a><a href="mailto:a@b.c">2</a><a href="https://x.y/z">3</a>');
});

test('bodyOf and sectionOf', () => {
  const doc = '<html><body><section id="a"><p>1</p></section><section id="b">2</section></body></html>';
  assert.equal(normalizeHtml(`<body>${sectionOf(doc, '#b')}</body>`), '<section id="b">2</section>');
  assert.match(bodyOf(doc), /<section id="a">/);
  assert.throws(() => sectionOf(doc, '#nope'), /no element matches #nope/);
});

test('ignores the b-<type> class that marks a block root', () => {
  assert.equal(normalizeHtml('<body><section class="hero b-hero">x</section></body>'),
               normalizeHtml('<body><section class="hero">x</section></body>'));
});
