/*
 * The page editor's API (spec docs/superpowers/specs/2026-09-27-page-editor-
 * design.md §4.2), mounted under /api/admin behind its admin-only guard. Thin:
 * the rules are in server/cms/editor-rules.js, the reads and writes in
 * server/cms/editor.js.
 */
const express = require('express');
const { EditorError } = require('../../cms/editor');
const { META_FIELDS } = require('../../cms/editor-rules');
const { SITE_FIELDS } = require('../../cms/site-fields');
const { BLOCK_TYPES, getBlock } = require('../../../blocks');

module.exports = function editorRoutes({ editor, getCategories, audit = require('../../lib/audit') }) {
  const router = express.Router();
  const id = (req) => Number(req.params.id);
  const who = (req) => (req.user && (req.user.name || req.user.email)) || null;
  // A published page shows at once, not at the cache's next 5-second check;
  // the menu and footer are in every cached page.
  const clear = (req) => { if (req.app.locals.cms) req.app.locals.cms.clear(); };

  const run = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof EditorError) {
        return res.status(err.status).json({ error: err.message, ...(err.errors ? { errors: err.errors } : {}) });
      }
      console.error('Page editor failed:', err.message);
      res.status(500).json({ error: 'The page editor could not reach the database.' });
    }
  };
  const log = (req, action, entityId, summary, extra = {}) =>
    audit.record(req, { action, entityType: 'Page', entityId, summary, ...extra });

  router.get('/blocks', run(async (req, res) => {
    res.json({
      blocks: Object.fromEntries(BLOCK_TYPES.map((t) => [t, { label: getBlock(t).label, fields: getBlock(t).fields }])),
      site: SITE_FIELDS,
      meta: META_FIELDS,
      categories: await getCategories(),
    });
  }));

  router.get('/pages', run(async (req, res) => res.json(await editor.listPages())));
  router.get('/pages/:id', run(async (req, res) => res.json(await editor.openPage(id(req)))));
  router.get('/pages/:id/versions', run(async (req, res) => res.json(await editor.versions(id(req)))));

  router.put('/pages/:id/draft', run(async (req, res) => {
    const draft = await editor.saveDraft(id(req), req.body || {}, req.user.id, await getCategories());
    await log(req, 'page.draft.save', id(req), `Saved a draft of ${draft.path}`);
    res.json({ versionId: draft.id });
  }));

  router.delete('/pages/:id/draft', run(async (req, res) => {
    const { path } = await editor.discardDraft(id(req));
    await log(req, 'page.draft.discard', id(req), `Discarded the draft of ${path}`);
    res.json({ ok: true });
  }));

  router.post('/pages/:id/publish', run(async (req, res) => {
    const version = await editor.publish(id(req), req.body || {}, req.user.id);
    clear(req);
    await log(req, 'page.publish', id(req), `Published ${version.path}`, { after: { versionId: version.id } });
    res.json({ versionId: version.id });
  }));

  router.post('/pages/:id/versions/:versionId/restore', run(async (req, res) => {
    const draft = await editor.restore(id(req), Number(req.params.versionId), req.user.id);
    await log(req, 'page.restore', id(req), `Restored version ${req.params.versionId} of ${draft.path} into the draft`);
    res.json({ versionId: draft.id });
  }));

  router.get('/site', run(async (req, res) => res.json(await editor.openSite())));

  router.put('/site/draft', run(async (req, res) => {
    const saved = await editor.saveSiteDraft(req.body || {}, who(req));
    await audit.record(req, { action: 'site.draft.save', entityType: 'SiteSetting', summary: 'Saved a draft of the menu and footer' });
    res.json(saved);
  }));

  router.delete('/site/draft', run(async (req, res) => {
    await editor.discardSiteDraft();
    await audit.record(req, { action: 'site.draft.discard', entityType: 'SiteSetting', summary: 'Discarded the menu and footer draft' });
    res.json({ ok: true });
  }));

  router.post('/site/publish', run(async (req, res) => {
    const { before, after } = await editor.publishSite(req.body || {}, who(req));
    clear(req);
    await audit.record(req, { action: 'site.publish', entityType: 'SiteSetting', summary: 'Published the menu and footer', before, after });
    res.json({ ok: true });
  }));

  return router;
};
