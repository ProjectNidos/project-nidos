/*
 * What the page middleware reads: published pages, and an admin's preview of a
 * draft. The editor's writes (drafts, publish, restore) are in editor.js.
 */
function createStore(prisma) {
  const site = (key) => prisma.site.findUnique({ where: { key } });

  return {
    async listPublishedPaths(siteKey) {
      const s = await site(siteKey);
      if (!s) return [];
      const rows = await prisma.page.findMany({
        where: { siteId: s.id, deletedAt: null, publishedVersionId: { not: null } },
        select: { path: true },
      });
      return rows.map((r) => r.path);
    },

    async getPublished(siteKey, path) {
      const s = await site(siteKey);
      if (!s) return null;
      const page = await prisma.page.findUnique({ where: { siteId_path: { siteId: s.id, path } } });
      if (!page || page.deletedAt || !page.publishedVersionId) return null;
      const version = await prisma.pageVersion.findUnique({ where: { id: page.publishedVersionId } });
      return version ? { page, blocks: version.blocks, versionId: version.id } : null;
    },

    async getPublishedVersionId(siteKey, path) {
      const s = await site(siteKey);
      if (!s) return null;
      const page = await prisma.page.findUnique({
        where: { siteId_path: { siteId: s.id, path } },
        select: { publishedVersionId: true, deletedAt: true },
      });
      return page && !page.deletedAt ? page.publishedVersionId : null;
    },

    // The live menu, footer and labels; with { draft: true }, the editor's
    // unpublished draft of them over the live ones.
    async getSiteSettings(siteKey, { draft = false } = {}) {
      const s = await site(siteKey);
      const rows = s ? await prisma.siteSetting.findMany({ where: { siteId: s.id } }) : [];
      const { draft: pending, ...live } = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return draft && pending ? { ...live, ...pending } : live;
    },

    // The page as the editor has it: its draft, or its published version when
    // there is none, with that version's search texts (spec §4.4).
    async getDraft(siteKey, path) {
      const s = await site(siteKey);
      if (!s) return null;
      const page = await prisma.page.findUnique({ where: { siteId_path: { siteId: s.id, path } } });
      if (!page || page.deletedAt) return null;
      const version = await prisma.pageVersion.findFirst({ where: { pageId: page.id, kind: 'draft' }, orderBy: { id: 'desc' } })
        || (page.publishedVersionId && await prisma.pageVersion.findUnique({ where: { id: page.publishedVersionId } }));
      if (!version) return null;
      const meta = version.meta || {};
      return {
        page: { ...page, seoTitle: meta.seoTitle || page.seoTitle, seoDescription: meta.seoDescription || page.seoDescription },
        blocks: version.blocks,
        versionId: version.id,
      };
    },
  };
}

module.exports = { createStore };
