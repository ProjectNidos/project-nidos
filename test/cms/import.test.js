const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const { runImport } = require('../../scripts/cms-import');
const CONTENT = require('../../site/content.en.json');

const ROOT = path.join(__dirname, '..', '..');
const PATHS = ['/', '/nidos/digitalization.html', '/nidos/pricing.html', '/nidos/privacy.html',
  '/nidos/terms.html', '/nidos/cookie-policy.html', '/nidos/gdpr.html', '/404'];
// Today's contact-form option values (site/content.en.json contact.options[]),
// which is what leads.interestMap is keyed on in production.
const OPTION_VALUES = CONTENT.contact.options.map((o) => o.value);

/*
 * An in-memory stand-in for the Prisma client, implementing only the calls
 * runImport makes. $transaction hands the callback the same object it was
 * called on - runImport never needs a distinct `tx`.
 */
function createFakePrisma(siteContentSeed = []) {
  let ids = { site: 0, page: 0, pageVersion: 0, siteSetting: 0 };
  const sites = new Map(); // key -> row
  const pages = new Map(); // "siteId:path" -> row
  const pageVersions = new Map(); // id -> row
  const siteSettings = new Map(); // "siteId:key" -> row
  const siteContent = siteContentSeed.map((row) => ({ ...row }));

  const findPageById = (id) => [...pages.values()].find((p) => p.id === id);

  const fake = {
    site: {
      async upsert({ where: { key }, update, create }) {
        const existing = sites.get(key);
        if (existing) { Object.assign(existing, update); return existing; }
        const row = { id: ++ids.site, ...create };
        sites.set(key, row);
        return row;
      },
      async findUnique({ where: { key } }) {
        return sites.get(key) || null;
      },
    },
    siteSetting: {
      async findUnique({ where: { siteId_key: { siteId, key } } }) {
        return siteSettings.get(`${siteId}:${key}`) || null;
      },
      async upsert({ where: { siteId_key: { siteId, key } }, update, create }) {
        const k = `${siteId}:${key}`;
        const existing = siteSettings.get(k);
        if (existing) { Object.assign(existing, update); return existing; }
        const row = { id: ++ids.siteSetting, ...create };
        siteSettings.set(k, row);
        return row;
      },
      async findMany({ where: { siteId } }) {
        return [...siteSettings.values()].filter((r) => r.siteId === siteId);
      },
    },
    page: {
      async findUnique({ where: { siteId_path } }) {
        const { siteId, path: p } = siteId_path;
        return pages.get(`${siteId}:${p}`) || null;
      },
      async update({ where: { id }, data }) {
        const row = findPageById(id);
        Object.assign(row, data);
        return row;
      },
      async create({ data }) {
        const row = { id: ++ids.page, publishedVersionId: null, deletedAt: null, ...data };
        pages.set(`${row.siteId}:${row.path}`, row);
        return row;
      },
    },
    pageVersion: {
      async create({ data }) {
        const row = { id: ++ids.pageVersion, ...data };
        pageVersions.set(row.id, row);
        return row;
      },
      async findUnique({ where: { id } }) {
        return pageVersions.get(id) || null;
      },
    },
    siteContent: {
      async findMany({ where: { page: p } }) {
        return siteContent.filter((r) => r.page === p).map(({ key, value }) => ({ key, value }));
      },
    },
    async $transaction(fn) {
      return fn(fake);
    },
    // Test-only window onto the store, for assertions.
    _sites: sites,
    _pages: pages,
    _pageVersions: pageVersions,
    _siteSettings: siteSettings,
  };
  return fake;
}

function fakeLog() {
  const calls = { log: [], warn: [], error: [] };
  return {
    calls,
    log: (...a) => calls.log.push(a.join(' ')),
    warn: (...a) => calls.warn.push(a.join(' ')),
    error: (...a) => calls.error.push(a.join(' ')),
  };
}

function fakeAudit() {
  const entries = [];
  return { entries, record: async (_req, entry) => { entries.push(entry); } };
}

// The real content.render() also applies saved overrides; the fake just reads
// the committed file, because the override paths this test exercises
// (index.html) go through buildPages' own prisma.siteContent query, not
// through content.render() at all. fields() gives what the real one's keys
// are: the committed file's data-cms attributes, first occurrence wins.
// ensureMigrated() stands in for the English-only migration
// (server/lib/content.js) having already run - true unless a test says
// otherwise.
const readPage = (page) => fs.readFileSync(path.join(ROOT, page), 'utf8');
const fakeContent = {
  ensureMigrated: async () => true,
  render: async (page) => readPage(page),
  fields: (page) => {
    const $ = cheerio.load(readPage(page));
    return [...new Set($('[data-cms]').map((_, el) => $(el).attr('data-cms')).get())].map((key) => ({ key }));
  },
};

function fakeSettings(interestMap) {
  return { get: async (key) => (key === 'leads.interestMap' ? interestMap : undefined) };
}

const fullInterestMap = Object.fromEntries(OPTION_VALUES.map((v) => [v, 'general']));

function makeDeps({ interestMap = fullInterestMap, audit = fakeAudit(), content = fakeContent } = {}) {
  return { settings: fakeSettings(interestMap), content, audit };
}

test('first run creates 8 pages, 8 versions, 3 site settings, and one audit entry', async () => {
  const prisma = createFakePrisma();
  const audit = fakeAudit();
  const log = fakeLog();

  const result = await runImport({ prisma, log, deps: makeDeps({ audit }) });

  assert.deepEqual(result.created.slice().sort(), PATHS.slice().sort());
  assert.deepEqual(result.skipped, []);

  assert.equal(prisma._pages.size, 8);
  assert.equal(prisma._pageVersions.size, 8);
  for (const version of prisma._pageVersions.values()) assert.equal(version.note, 'Imported from site files');
  for (const page of prisma._pages.values()) {
    assert.ok(page.publishedVersionId, `${page.path} has no publishedVersionId`);
    assert.equal(prisma._pageVersions.get(page.publishedVersionId).pageId, page.id);
  }

  assert.equal(prisma._siteSettings.size, 3);
  assert.deepEqual([...prisma._siteSettings.values()].map((s) => s.key).sort(), ['footer', 'labels', 'nav']);

  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'cms.import');
  assert.match(audit.entries[0].summary, /^Imported 8 page\(s\)/);
});

test('second run skips every page that already exists and writes nothing new', async () => {
  const prisma = createFakePrisma();
  const audit = fakeAudit();
  const log = fakeLog();

  await runImport({ prisma, log, deps: makeDeps({ audit }) });
  const second = await runImport({ prisma, log, deps: makeDeps({ audit }) });

  assert.deepEqual(second.created, []);
  assert.deepEqual(second.skipped.slice().sort(), PATHS.slice().sort());
  assert.equal(prisma._pageVersions.size, 8); // no new versions
  assert.equal(audit.entries.length, 1); // no new audit entry
});

test('replace: true creates new versions for all 8 pages', async () => {
  const prisma = createFakePrisma();
  const audit = fakeAudit();
  const log = fakeLog();

  await runImport({ prisma, log, deps: makeDeps({ audit }) });
  const replaced = await runImport({ prisma, replace: true, log, deps: makeDeps({ audit }) });

  assert.deepEqual(replaced.created.slice().sort(), PATHS.slice().sort());
  assert.deepEqual(replaced.skipped, []);
  assert.equal(prisma._pageVersions.size, 16); // 8 original + 8 replaced
  assert.equal(prisma._pages.size, 8); // same 8 pages, not duplicated
  assert.equal(audit.entries.length, 2);
});

test('an incomplete English-only content migration refuses the import and writes nothing', async () => {
  const prisma = createFakePrisma();
  const audit = fakeAudit();
  const log = fakeLog();
  const unmigrated = { ...fakeContent, ensureMigrated: async () => false };

  await assert.rejects(
    () => runImport({ prisma, log, deps: makeDeps({ audit, content: unmigrated }) }),
    /content migration did not complete/,
  );

  assert.equal(prisma._sites.size, 0);
  assert.equal(prisma._pages.size, 0);
  assert.equal(prisma._pageVersions.size, 0);
  assert.equal(prisma._siteSettings.size, 0);
  assert.equal(audit.entries.length, 0);
});

test('an interestMap missing one option value refuses the import and writes nothing', async () => {
  const prisma = createFakePrisma();
  const audit = fakeAudit();
  const log = fakeLog();
  const incomplete = { ...fullInterestMap };
  delete incomplete[OPTION_VALUES[0]];

  await assert.rejects(
    () => runImport({ prisma, log, deps: makeDeps({ interestMap: incomplete, audit }) }),
    /import refused/,
  );

  assert.equal(prisma._sites.size, 0);
  assert.equal(prisma._pages.size, 0);
  assert.equal(prisma._pageVersions.size, 0);
  assert.equal(prisma._siteSettings.size, 0);
  assert.equal(audit.entries.length, 0);
});

test('a hero.titleLead override on index.html carries into the / page\'s hero block', async () => {
  const prisma = createFakePrisma([{ page: 'index.html', key: 'hero.titleLead', value: 'Edited hero lead.' }]);
  const log = fakeLog();

  await runImport({ prisma, log, deps: makeDeps() });

  const home = [...prisma._pages.values()].find((p) => p.path === '/');
  const version = prisma._pageVersions.get(home.publishedVersionId);
  const hero = version.blocks.find((b) => b.type === 'hero');
  assert.equal(hero.props.titleLead, 'Edited hero lead.');
});

test('a meta.ogTitle override on index.html warns once and is named in the audit summary', async () => {
  const prisma = createFakePrisma([{ page: 'index.html', key: 'meta.ogTitle', value: 'Edited OG title.' }]);
  const audit = fakeAudit();
  const log = fakeLog();

  await runImport({ prisma, log, deps: makeDeps({ audit }) });

  assert.equal(log.calls.warn.length, 1);
  assert.match(log.calls.warn[0], /index\.html/);
  assert.match(log.calls.warn[0], /meta\.ogTitle/);

  assert.equal(audit.entries.length, 1);
  assert.match(audit.entries[0].summary, /Not carried: index\.html:meta\.ogTitle\.?$/);
});

test('a saved key no longer on the page is reported, not refused, and the rest still carries', async () => {
  // form.optionEsFondi was a contact option on an older home page; production
  // may still hold its row, which today's renderer skips and the admin cannot show.
  const prisma = createFakePrisma([
    { page: 'index.html', key: 'form.optionEsFondi', value: 'EU funds' },
    { page: 'index.html', key: 'hero.titleLead', value: 'Edited hero lead.' },
  ]);
  const audit = fakeAudit();
  const log = fakeLog();

  const result = await runImport({ prisma, log, deps: makeDeps({ audit }) });

  assert.deepEqual(result.created.slice().sort(), PATHS.slice().sort());
  const home = [...prisma._pages.values()].find((p) => p.path === '/');
  const hero = prisma._pageVersions.get(home.publishedVersionId).blocks.find((b) => b.type === 'hero');
  assert.equal(hero.props.titleLead, 'Edited hero lead.');

  assert.deepEqual(log.calls.warn, ['  ! index.html: saved "form.optionEsFondi" is not carried over — it is no longer on the page.']);
  assert.match(audit.entries[0].summary, /Not carried: index\.html:form\.optionEsFondi\.$/);
});

test('a saved key that IS on the page but cannot be placed still refuses the import', async () => {
  // A data-cms key the page carries but the content file has no field for is
  // a real bug, not a stale row: the refusal must survive the stale-key filter.
  const content = { ...fakeContent, fields: (page) => [...fakeContent.fields(page), { key: 'hero.nowhere' }] };
  const prisma = createFakePrisma([{ page: 'index.html', key: 'hero.nowhere', value: 'x' }]);

  await assert.rejects(
    () => runImport({ prisma, log: fakeLog(), deps: makeDeps({ content }) }),
    /override hero\.nowhere: no such field/,
  );
  assert.equal(prisma._pages.size, 0);
});
