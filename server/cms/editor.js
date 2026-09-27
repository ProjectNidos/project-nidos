/*
 * The page editor's reads and writes (spec docs/superpowers/specs/2026-09-27-
 * page-editor-design.md §4.1), in the part 1a tables. What a save may change is
 * decided in editor-rules.js; this file only moves versions around.
 *
 * - A page has at most one working draft. Each save replaces it with a new row,
 *   so its id changes on every save: that id is the conflict token.
 * - Publishing turns the draft into a new published version and points the page
 *   at it. A published version is never changed.
 * - The menu and footer draft is the SiteSetting row "draft", holding
 *   { nav, footer, labels } until it is published over the live rows.
 */
const { checkDraft, checkSite } = require('./editor-rules');

const LIVE_KEYS = ['nav', 'footer', 'labels'];

class EditorError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
const conflict = () => new EditorError(409, 'This was changed elsewhere since you opened it. Reload to see the latest.');
const nothingToPublish = () => new EditorError(409, 'There is nothing to publish: save a draft first.');
const invalid = (errors) => new EditorError(422, 'Some fields need attention.', errors);

// Search texts of a version; imported versions carry none, so the page's own.
const metaOf = (version, page) => version.meta || { seoTitle: page.seoTitle, seoDescription: page.seoDescription };

function createEditor(prisma, { siteKey = 'projectnidos' } = {}) {
  async function site(db) {
    const s = await db.site.findUnique({ where: { key: siteKey } });
    if (!s) throw new EditorError(404, 'The pages have not been imported yet.');
    return s;
  }

  async function pageWithDraft(db, id) {
    const s = await site(db);
    const page = Number.isInteger(id) ? await db.page.findFirst({ where: { id, siteId: s.id, deletedAt: null } }) : null;
    if (!page) throw new EditorError(404, 'No such page.');
    const draft = await db.pageVersion.findFirst({ where: { pageId: page.id, kind: 'draft' }, orderBy: { id: 'desc' } });
    return { page, draft };
  }

  // id -> "name", for the admin's lists; the import published with no one.
  async function names(ids) {
    const wanted = [...new Set(ids.filter(Boolean))];
    const users = wanted.length ? await prisma.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((u) => [u.id, u.name || u.email]));
    return (id) => (id ? byId.get(id) || 'A former user' : 'Imported');
  }

  // The menu and footer rows, and the token that changes whenever they do.
  async function siteRows(db) {
    const s = await site(db);
    const rows = await db.siteSetting.findMany({ where: { siteId: s.id, key: { in: [...LIVE_KEYS, 'draft'] } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    const draft = byKey.draft || null;
    const live = Object.fromEntries(LIVE_KEYS.map((k) => [k, byKey[k] ? byKey[k].value : null]));
    const latest = Math.max(0, ...LIVE_KEYS.map((k) => (byKey[k] ? new Date(byKey[k].updatedAt).getTime() : 0)));
    const base = draft ? `draft:${draft.id}:${new Date(draft.updatedAt).getTime()}` : `live:${latest}`;
    return { s, live, draft, base };
  }

  return {
    async listPages() {
      const s = await site(prisma);
      const pages = await prisma.page.findMany({ where: { siteId: s.id, deletedAt: null }, orderBy: { id: 'asc' } });
      const ids = pages.map((p) => p.id);
      const drafts = await prisma.pageVersion.findMany({ where: { pageId: { in: ids }, kind: 'draft' }, select: { pageId: true } });
      const live = await prisma.pageVersion.findMany({
        where: { id: { in: pages.map((p) => p.publishedVersionId).filter(Boolean) } },
        select: { id: true, createdAt: true, createdById: true },
      });
      const nameOf = await names(live.map((v) => v.createdById));
      const liveById = new Map(live.map((v) => [v.id, v]));
      const hasDraft = new Set(drafts.map((d) => d.pageId));
      return pages.map((p) => {
        const v = liveById.get(p.publishedVersionId);
        return { id: p.id, title: p.title, path: p.path, hasDraft: hasDraft.has(p.id),
          publishedAt: v ? v.createdAt : null, publishedBy: v ? nameOf(v.createdById) : null };
      });
    },

    async openPage(id) {
      const { page, draft } = await pageWithDraft(prisma, id);
      const version = draft || await prisma.pageVersion.findUnique({ where: { id: page.publishedVersionId } });
      return { page: { id: page.id, title: page.title, path: page.path, layout: page.layout },
        versionId: version.id, kind: version.kind, meta: metaOf(version, page), blocks: version.blocks };
    },

    async saveDraft(id, { baseVersionId, meta, blocks } = {}, userId, categories) {
      return prisma.$transaction(async (tx) => {
        const { page, draft } = await pageWithDraft(tx, id);
        const current = draft || await tx.pageVersion.findUnique({ where: { id: page.publishedVersionId } });
        if (baseVersionId !== current.id) throw conflict();
        const out = checkDraft({ layout: page.layout, before: current.blocks, blocks, meta, categories });
        if (out.errors.length) throw invalid(out.errors);
        if (draft) await tx.pageVersion.delete({ where: { id: draft.id } });
        const saved = await tx.pageVersion.create({
          data: { pageId: page.id, kind: 'draft', blocks: out.blocks, meta: out.meta, createdById: userId },
        });
        return { id: saved.id, path: page.path };
      });
    },

    async discardDraft(id) {
      const { page } = await pageWithDraft(prisma, id);
      await prisma.pageVersion.deleteMany({ where: { pageId: page.id, kind: 'draft' } });
      return { path: page.path };
    },

    async publish(id, { baseVersionId } = {}, userId) {
      return prisma.$transaction(async (tx) => {
        const { page, draft } = await pageWithDraft(tx, id);
        if (!draft) throw nothingToPublish();
        if (draft.id !== baseVersionId) throw conflict();
        const meta = metaOf(draft, page);
        const version = await tx.pageVersion.create({
          data: { pageId: page.id, kind: 'published', blocks: draft.blocks, meta, createdById: userId },
        });
        await tx.page.update({ where: { id: page.id },
          data: { publishedVersionId: version.id, seoTitle: meta.seoTitle, seoDescription: meta.seoDescription } });
        await tx.pageVersion.delete({ where: { id: draft.id } });
        return { id: version.id, path: page.path };
      });
    },

    async versions(id) {
      const { page } = await pageWithDraft(prisma, id);
      const list = await prisma.pageVersion.findMany({
        where: { pageId: page.id, kind: 'published' }, orderBy: { id: 'desc' },
        select: { id: true, createdAt: true, createdById: true },
      });
      const nameOf = await names(list.map((v) => v.createdById));
      return list.map((v) => ({ id: v.id, createdAt: v.createdAt, by: nameOf(v.createdById), live: v.id === page.publishedVersionId }));
    },

    async restore(id, versionId, userId) {
      return prisma.$transaction(async (tx) => {
        const { page, draft } = await pageWithDraft(tx, id);
        const version = Number.isInteger(versionId)
          ? await tx.pageVersion.findFirst({ where: { id: versionId, pageId: page.id, kind: 'published' } })
          : null;
        if (!version) throw new EditorError(404, 'No such version of this page.');
        if (draft) await tx.pageVersion.delete({ where: { id: draft.id } });
        const saved = await tx.pageVersion.create({
          data: { pageId: page.id, kind: 'draft', blocks: version.blocks, meta: metaOf(version, page), createdById: userId },
        });
        return { id: saved.id, path: page.path };
      });
    },

    async openSite() {
      const { live, draft, base } = await siteRows(prisma);
      return { live, draft: draft ? draft.value : null, base };
    },

    async saveSiteDraft({ base, settings } = {}, updatedBy) {
      return prisma.$transaction(async (tx) => {
        const { s, live, base: current } = await siteRows(tx);
        if (base !== current) throw conflict();
        const out = checkSite({ live, settings });
        if (out.errors.length) throw invalid(out.errors);
        await tx.siteSetting.upsert({
          where: { siteId_key: { siteId: s.id, key: 'draft' } },
          update: { value: out.settings, updatedBy },
          create: { siteId: s.id, key: 'draft', value: out.settings, updatedBy },
        });
        return { base: (await siteRows(tx)).base };
      });
    },

    async discardSiteDraft() {
      const s = await site(prisma);
      await prisma.siteSetting.deleteMany({ where: { siteId: s.id, key: 'draft' } });
    },

    async publishSite({ base } = {}, updatedBy) {
      return prisma.$transaction(async (tx) => {
        const { s, live, draft, base: current } = await siteRows(tx);
        if (!draft) throw nothingToPublish();
        if (base !== current) throw conflict();
        for (const key of LIVE_KEYS) {
          await tx.siteSetting.upsert({
            where: { siteId_key: { siteId: s.id, key } },
            update: { value: draft.value[key], updatedBy },
            create: { siteId: s.id, key, value: draft.value[key], updatedBy },
          });
        }
        await tx.siteSetting.delete({ where: { id: draft.id } });
        return { before: live, after: draft.value };
      });
    },
  };
}

module.exports = { createEditor, EditorError };
