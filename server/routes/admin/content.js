/*
 * The admin side of site content: list the editable fields on a page, save an
 * override, or clear one back to whatever the HTML file says.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../../prisma');
const audit = require('../../lib/audit');
const content = require('../../lib/content');

const MAX_VALUE = 5000;

// Which pages can be edited at all.
router.get('/pages', async (req, res) => {
    try {
        const counts = await prisma.siteContent.groupBy({
            by: ['page'],
            _count: { _all: true },
        });
        const edited = Object.fromEntries(counts.map((c) => [c.page, c._count._all]));

        res.json(
            content.MANAGED_PAGES.map((page) => ({
                page,
                overrides: edited[page] || 0,
            }))
        );
    } catch (error) {
        console.error('Content pages failed:', error);
        res.status(500).json({ error: 'Failed to list pages.' });
    }
});

/*
 * The fields on one page. `original` is read from the HTML file every time
 * rather than snapshotted, so if a developer edits the committed copy the admin
 * UI shows the new text as the fallback instead of a stale one.
 */
router.get('/fields', async (req, res) => {
    const page = req.query.page;
    if (!content.isManaged(page)) {
        return res.status(400).json({ error: 'Unknown page.' });
    }

    try {
        const [fields, rows] = await Promise.all([
            Promise.resolve(content.fields(page)),
            prisma.siteContent.findMany({ where: { page } }),
        ]);

        const stored = Object.fromEntries(rows.map((r) => [r.key, r]));

        res.json({
            page,
            fields: fields.map((f) => ({
                ...f,
                value: stored[f.key] ? stored[f.key].value : null,
                updatedAt: stored[f.key] ? stored[f.key].updatedAt : null,
                updatedBy: stored[f.key] ? stored[f.key].updatedBy : null,
            })),
        });
    } catch (error) {
        console.error('Content fields failed:', error);
        res.status(500).json({ error: 'Failed to read the page.' });
    }
});

// Save one override.
router.put('/', async (req, res) => {
    const { page, key, value } = req.body;

    if (!content.isManaged(page)) return res.status(400).json({ error: 'Unknown page.' });
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'A field key is required.' });
    if (typeof value !== 'string') return res.status(400).json({ error: 'Value must be text.' });
    if (value.length > MAX_VALUE) {
        return res.status(400).json({ error: `Keep it under ${MAX_VALUE} characters.` });
    }

    // The key has to exist in the file, or the override would be invisible and
    // unreachable - a silent no-op is worse than a refusal.
    const known = content.fields(page).some((f) => f.key === key);
    if (!known) return res.status(400).json({ error: `No field "${key}" on ${page}.` });

    try {
        const before = await prisma.siteContent.findUnique({
            where: { page_key: { page, key } },
        });

        const saved = await prisma.siteContent.upsert({
            where: { page_key: { page, key } },
            update: { value, updatedBy: req.user.email },
            create: { page, key, value, updatedBy: req.user.email },
        });

        content.invalidate();

        await audit.record(req, {
            action: 'content.update',
            entityType: 'SiteContent',
            entityId: saved.id,
            summary: `Edited ${key} on ${page}`,
            before: before ? { value: before.value } : null,
            after: { value },
        });

        res.json(saved);
    } catch (error) {
        console.error('Content save failed:', error);
        res.status(500).json({ error: 'Failed to save.' });
    }
});

// Revert to the text committed in the HTML file.
router.delete('/', async (req, res) => {
    const { page, key } = req.body;
    if (!content.isManaged(page) || !key) {
        return res.status(400).json({ error: 'Unknown page or field.' });
    }

    try {
        const before = await prisma.siteContent.findUnique({
            where: { page_key: { page, key } },
        });
        if (!before) return res.json({ success: true, alreadyOriginal: true });

        await prisma.siteContent.delete({ where: { page_key: { page, key } } });
        content.invalidate();

        await audit.record(req, {
            action: 'content.revert',
            entityType: 'SiteContent',
            summary: `Reverted ${key} on ${page} to the original`,
            before: { value: before.value },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Content revert failed:', error);
        res.status(500).json({ error: 'Failed to revert.' });
    }
});

module.exports = router;
