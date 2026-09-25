const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize } = require('../../server/cms/richtext');

test('keeps the inline tags the site uses', () => {
  const s = '<strong>Project Nidos</strong> and <span class="key">systems</span><br>x';
  assert.equal(sanitize(s, 'inline'), s);
});
test('strips script, style, comments and event handlers, keeps text', () => {
  assert.equal(sanitize('a<script>alert(1)</script>b<style>*{}</style><!-- c -->', 'inline'), 'ab');
  assert.equal(sanitize('<strong onclick="x()">hi</strong>', 'inline'), '<strong>hi</strong>');
  assert.equal(sanitize('<img src=x onerror=alert(1)>ok', 'inline'), 'ok');
});
test('rejects javascript links but keeps their text', () => {
  assert.equal(sanitize('<a href="javascript:alert(1)">go</a>', 'inline'), '<a>go</a>');
  assert.equal(sanitize('<a href=" JavaScript:alert(1)">go</a>', 'inline'), '<a>go</a>');
  assert.equal(sanitize('<a href="/nidos/pricing.html" target="_blank">p</a>', 'inline'),
    '<a href="/nidos/pricing.html">p</a>');
});
test('span keeps only class="key"', () => {
  assert.equal(sanitize('<span class="evil key" style="x">a</span>', 'inline'), '<span class="key">a</span>');
  assert.equal(sanitize('<span style="x">a</span>', 'inline'), 'a');
});
test('full profile allows block structure and tables, inline does not', () => {
  const s = '<h3>T</h3><p>a <code>x</code></p><ul><li>b</li></ul><address>c</address>';
  assert.equal(sanitize(s, 'full'), s);
  assert.equal(sanitize(s, 'inline'), 'Ta xbc');
});
test('legal tables keep their class, scope and data-label, nothing else', () => {
  const s = '<table class="legal-table x" style="y"><thead><tr><th scope="col" onclick="z">A</th></tr></thead>'
    + '<tbody><tr><td data-label="A" class="q">1</td></tr></tbody></table>';
  assert.equal(sanitize(s, 'full'),
    '<table class="legal-table"><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td data-label="A">1</td></tr></tbody></table>');
  assert.equal(sanitize('<table class="other"><tbody><tr><th scope="evil">h</th></tr></tbody></table>', 'full'),
    '<table><tbody><tr><th>h</th></tr></tbody></table>');
});
test('an attribute value cannot break out of its quotes', () => {
  const out = sanitize('<table><tbody><tr><td data-label="x&quot; onmouseover=&quot;y">1</td></tr></tbody></table>', 'full');
  assert.match(out, /<td data-label="x&quot; onmouseover=&quot;y">/);
});
test('null and undefined become empty', () => {
  assert.equal(sanitize(undefined, 'inline'), '');
});
test('a stray closing tag does not swallow the rest', () => {
  assert.equal(sanitize('a</div>b', 'inline'), 'ab');
  assert.equal(sanitize('<p>x</p></div><p>y</p>', 'full'), '<p>x</p><p>y</p>');
});
