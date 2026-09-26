const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { CSS, stylesFor, serveCss } = require('../../server/cms/assets');

test("a block page loads base.css, then its layout's sheet by content hash", () => {
  assert.deepEqual(stylesFor('home'), ['/base.css?v=6', `/cms/home.css?v=${CSS.home.hash}`]);
  assert.deepEqual(stylesFor('standard'), ['/base.css?v=6', `/cms/standard.css?v=${CSS.standard.hash}`]);
  assert.match(CSS.home.hash, /^[0-9a-f]{12}$/);
  assert.notEqual(CSS.home.hash, CSS.standard.hash);
});

test('each layout sheet: vocabulary, then blocks, then diagrams, then its frame', () => {
  for (const [layout, frameRule] of [['home', '.intro-screen {'], ['standard', '.footer-lattice {']]) {
    const { css } = CSS[layout];
    const at = (s) => {
      const i = css.indexOf(s);
      assert.ok(i >= 0, `${layout}: missing ${s}`);
      return i;
    };
    const order = [at('.lattice {'), at(':where(.b-hero).hero {'), at(':where(.b-contact-info) .contact-block {'),
      at('.v-box {'), at(frameRule)];
    assert.deepEqual(order, [...order].sort((a, b) => a - b), layout);
    assert.ok(!css.includes('/*'), `${layout}: no comments`);
  }
  assert.ok(!CSS.standard.css.includes('.intro-screen {'), 'the intro is the home frame only');
  assert.ok(!CSS.home.css.includes('.footer-lattice {'), 'the footer lattice is the standard frame only');
});

function call(layout, v) {
  const res = {
    headers: {},
    set(k, val) { this.headers[k] = val; return this; },
    type(t) { this.contentType = t; return this; },
    send(b) { this.body = b; return this; },
  };
  let passed = false;
  serveCss({ params: { layout }, query: v === undefined ? {} : { v } }, res, () => { passed = true; });
  return { res, passed };
}

test('the sheet at its own hash is kept for a year', () => {
  const { res } = call('home', CSS.home.hash);
  assert.equal(res.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(res.contentType, 'text/css');
  assert.equal(res.body, CSS.home.css);
});

// Review Focus 4: a page from before a deploy asks for a hash this server
// never built. It gets today's sheet, never pinned under the old address.
test('any other version is served, but not pinned', () => {
  for (const v of ['0123456789ab', undefined]) {
    const { res } = call('standard', v);
    assert.equal(res.headers['Cache-Control'], 'no-cache');
    assert.equal(res.body, CSS.standard.css);
  }
});

test('an unknown layout falls through', () => {
  for (const layout of ['print', 'constructor', '__proto__']) assert.equal(call(layout).passed, true, layout);
});

test('the route answers /cms/<layout>.css', async () => {
  const app = express();
  app.get('/cms/:layout.css', serveCss);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const ok = await fetch(`${base}/cms/home.css?v=${CSS.home.hash}`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /^text\/css/);
    assert.equal(await ok.text(), CSS.home.css);
    assert.equal((await fetch(`${base}/cms/print.css`)).status, 404);
  } finally {
    server.close();
  }
});

const fs = require('fs');
const path = require('path');
const conv = require('../../scripts/lib/cms-convert');
const { scriptsFor } = require('../../server/cms/assets');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const home = conv.convertHome(JSON.parse(read('site/content.en.json'))).blocks;

test("home: the layout's script, then its blocks', in the page on disk's order", () => {
  assert.deepEqual(scriptsFor('home', home), ['/nav-menu.js?v=1', '/landing.js?v=13', '/contact-form.js?v=1',
    '/pointer-pane.js?v=1', '/practice-visuals.js?v=1', '/orbital-hero.js?v=4', '/topology-bg.js?v=1']);
});

test("a standard page takes a home block's script with the block", () => {
  assert.deepEqual(scriptsFor('standard', home), ['/nav-menu.js?v=1', '/topology-bg.js?v=1',
    '/practice-visuals.js?v=1', '/contact-form.js?v=1', '/pointer-pane.js?v=1', '/orbital-hero.js?v=4']);
});

test('no block, no script', () => {
  assert.deepEqual(scriptsFor('standard', conv.convertPricing(read('nidos/pricing.html')).blocks),
    ['/nav-menu.js?v=1', '/topology-bg.js?v=1']);
  assert.deepEqual(scriptsFor('home', []), ['/nav-menu.js?v=1', '/landing.js?v=13', '/topology-bg.js?v=1']);
});
