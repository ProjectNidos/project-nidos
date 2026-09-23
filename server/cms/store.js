/*
 * Read access to published pages. Part 2 adds the writes (drafts, publish,
 * restore); the middleware only ever needs these four.
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

    async getSiteSettings(siteKey) {
      const s = await site(siteKey);
      const rows = s ? await prisma.siteSetting.findMany({ where: { siteId: s.id } }) : [];
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  };
}

module.exports = { createStore };
