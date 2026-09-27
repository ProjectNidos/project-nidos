const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const conv = require('../../scripts/lib/cms-convert');
const { createEditor } = require('../../server/cms/editor');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const copy = (v) => structuredClone(v);
const pricing = conv.convertPricing(read('nidos/pricing.html'));
const live = conv.siteSettingsFrom(JSON.parse(read('site/content.en.json')));

// The few Prisma calls server/cms/editor.js makes, over arrays. Rows go in and
// come out as copies, as they would through a database.
function fakeDb(tables) {
  let nextId = 100;
  let clock = Date.parse('2026-09-27T00:00:00Z');
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (k === 'siteId_key') return row.siteId === v.siteId && row.key === v.key;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const rows = (name, where, orderBy) => {
    const found = tables[name].filter((r) => matches(r, where));
    return orderBy && orderBy.id === 'desc' ? found.reverse() : found;
  };
  const model = (name) => ({
    findUnique: async ({ where }) => copy(rows(name, where)[0] || null),
    findFirst: async ({ where, orderBy } = {}) => copy(rows(name, where, orderBy)[0] || null),
    findMany: async ({ where, orderBy } = {}) => copy(rows(name, where, orderBy)),
    create: async ({ data }) => {
      const row = { id: nextId++, createdAt: new Date(clock++), updatedAt: new Date(clock++), ...copy(data) };
      tables[name].push(row);
      return copy(row);
    },
    update: async ({ where, data }) => {
      const [row] = rows(name, where);
      if (!row) throw new Error('P2025: no such row');
      Object.assign(row, copy(data), { updatedAt: new Date(clock++) });
      return copy(row);
    },
    upsert: async ({ where, update, create }) => {
      const [row] = rows(name, where);
      if (!row) return model(name).create({ data: create });
      Object.assign(row, copy(update), { updatedAt: new Date(clock++) });
      return copy(row);
    },
    delete: async ({ where }) => {
      const i = tables[name].findIndex((r) => matches(r, where));
      if (i < 0) throw new Error('P2025: no such row');
      return copy(tables[name].splice(i, 1)[0]);
    },
    deleteMany: async ({ where }) => {
      const kept = tables[name].filter((r) => !matches(r, where));
      const count = tables[name].length - kept.length;
      tables[name].splice(0, Infinity, ...kept);
      return { count };
    },
  });
  const db = { tables, $executeRaw: async () => 0, $transaction: async (fn) => fn(db) };
  for (const name of Object.keys(tables)) db[name] = model(name);
  return db;
}

const seed = () => fakeDb({
  site: [{ id: 1, key: 'projectnidos' }],
  page: [
    { id: 3, siteId: 1, path: '/nidos/pricing.html', title: 'Pricing', layout: pricing.page.layout, deletedAt: null,
      seoTitle: pricing.page.seoTitle, seoDescription: pricing.page.seoDescription, publishedVersionId: 10 },
    { id: 4, siteId: 1, path: '/nidos/terms.html', title: 'Terms', layout: 'standard', deletedAt: null,
      seoTitle: 'Terms', seoDescription: 'Terms', publishedVersionId: 12 },
  ],
  pageVersion: [
    { id: 10, pageId: 3, kind: 'published', blocks: pricing.blocks, meta: null, createdById: null },
    { id: 12, pageId: 4, kind: 'published', blocks: [], meta: null, createdById: null },
  ],
  siteSetting: ['nav', 'footer', 'labels'].map((key, i) => ({
    id: 50 + i, siteId: 1, key, value: live[key], updatedBy: null, updatedAt: new Date('2026-09-25T00:00:00Z'),
  })),
  user: [],
});

const draft = (base, edit) => {
  const blocks = copy(pricing.blocks);
  const meta = { seoTitle: pricing.page.seoTitle, seoDescription: pricing.page.seoDescription };
  if (edit) edit(blocks, meta);
  return { baseVersionId: base, meta, blocks };
};
const draftsOf = (db) => db.tables.pageVersion.filter((v) => v.pageId === 3 && v.kind === 'draft').map((v) => v.id);

test('a save from a stale copy is refused and changes nothing', async () => {
  const db = seed();
  const editor = createEditor(db);
  const first = await editor.saveDraft(3, draft(10), 1, []);
  await assert.rejects(editor.saveDraft(3, draft(10), 1, []), { status: 409 });
  assert.deepEqual(draftsOf(db), [first.id]);
});

test('a publish from a stale copy is refused', async () => {
  const db = seed();
  const editor = createEditor(db);
  await editor.saveDraft(3, draft(10), 1, []);
  await assert.rejects(editor.publish(3, { baseVersionId: 10 }, 1), { status: 409 });
  assert.equal(db.tables.page[0].publishedVersionId, 10);
});

test('publishing makes the draft live, search texts and all, and leaves no draft', async () => {
  const db = seed();
  const editor = createEditor(db);
  const saved = await editor.saveDraft(3, draft(10, (b, meta) => { meta.seoTitle = 'What it costs'; }), 1, []);
  const version = await editor.publish(3, { baseVersionId: saved.id }, 1);
  assert.equal(db.tables.page[0].publishedVersionId, version.id);
  assert.equal(db.tables.page[0].seoTitle, 'What it costs');
  assert.deepEqual(draftsOf(db), []);
});

test('a page keeps one draft: a save or a publish clears any stray one', async () => {
  const db = seed();
  const editor = createEditor(db);
  const stray = (id) => db.tables.pageVersion.push({ id, pageId: 3, kind: 'draft', blocks: copy(pricing.blocks), meta: null, createdById: 1 });
  stray(200);
  stray(201);
  const saved = await editor.saveDraft(3, draft(201), 1, []);
  assert.deepEqual(draftsOf(db), [saved.id]);
  stray(300);
  await editor.publish(3, { baseVersionId: 300 }, 1);
  assert.deepEqual(draftsOf(db), []);
});

test("restoring another page's version is refused", async () => {
  const db = seed();
  await assert.rejects(createEditor(db).restore(3, 12, 1), { status: 404 });
  assert.deepEqual(draftsOf(db), []);
});

test('a menu and footer save from a stale copy is refused; publishing clears the draft', async () => {
  const db = seed();
  const editor = createEditor(db);
  const { base } = await editor.openSite();
  const saved = await editor.saveSiteDraft({ base, settings: copy(live) }, 'Ann');
  await assert.rejects(editor.saveSiteDraft({ base, settings: copy(live) }, 'Ann'), { status: 409 });
  await editor.publishSite({ base: saved.base }, 'Ann');
  assert.equal(db.tables.siteSetting.find((r) => r.key === 'draft'), undefined);
});

test('two saves at once leave one draft', { skip: process.env.CMS_DEV_DB !== '1' && 'set CMS_DEV_DB=1 to run against the dev database' }, async () => {
  require('../../scripts/lib/dev-db').useDevDatabase();
  const prisma = require('../../server/prisma');
  const editor = createEditor(prisma);
  const page = (await editor.listPages()).find((p) => p.path === '/nidos/pricing.html');
  try {
    const open = await editor.openPage(page.id);
    assert.equal(open.kind, 'published', 'Pricing already has a draft: discard it first');
    // Two connections open first, as in a running server: otherwise the second
    // save waits for its connection and starts after the first has finished.
    await Promise.all([prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`]);
    const save = () => editor.saveDraft(page.id, { baseVersionId: open.versionId, meta: open.meta, blocks: open.blocks }, null, []);
    const outcomes = (await Promise.allSettled([save(), save()])).map((r) => (r.status === 'fulfilled' ? 'saved' : String(r.reason.status)));
    assert.deepEqual(outcomes.sort(), ['409', 'saved']);
    assert.equal(await prisma.pageVersion.count({ where: { pageId: page.id, kind: 'draft' } }), 1);
  } finally {
    await prisma.pageVersion.deleteMany({ where: { pageId: page.id, kind: 'draft' } });
    await prisma.$disconnect();
  }
});

test('two menu and footer saves at once: one wins, the other is told', { skip: process.env.CMS_DEV_DB !== '1' && 'set CMS_DEV_DB=1 to run against the dev database' }, async () => {
  require('../../scripts/lib/dev-db').useDevDatabase();
  const prisma = require('../../server/prisma');
  const editor = createEditor(prisma);
  try {
    const open = await editor.openSite();
    assert.equal(open.draft, null, 'Menu & footer already have a draft: discard it first');
    await Promise.all([prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`]);
    const save = () => editor.saveSiteDraft({ base: open.base, settings: open.live }, 'editor test');
    const outcomes = (await Promise.allSettled([save(), save()])).map((r) => (r.status === 'fulfilled' ? 'saved' : String(r.reason.status)));
    assert.deepEqual(outcomes.sort(), ['409', 'saved']);
  } finally {
    await editor.discardSiteDraft();
    await prisma.$disconnect();
  }
});
