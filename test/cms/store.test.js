const test = require('node:test');
const assert = require('node:assert/strict');

test('store reads the imported pages', { skip: process.env.CMS_DEV_DB !== '1' && 'set CMS_DEV_DB=1 to run against the dev database' }, async () => {
  require('../../scripts/lib/dev-db').useDevDatabase();
  const prisma = require('../../server/prisma');
  const store = require('../../server/cms/store').createStore(prisma);
  try {
    const paths = await store.listPublishedPaths('projectnidos');
    assert.equal(paths.length, 8);
    const home = await store.getPublished('projectnidos', '/');
    assert.deepEqual(home.blocks.map((b) => b.type), ['hero', 'text', 'practice-cards', 'reasons', 'contact-form']);
    assert.equal(await store.getPublishedVersionId('projectnidos', '/'), home.versionId);
    assert.equal((await store.getSiteSettings('projectnidos')).nav.links.length, 4);
  } finally {
    await prisma.$disconnect();
  }
});
