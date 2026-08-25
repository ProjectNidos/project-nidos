/*
 * Reading the audit trail. Writes happen in server/lib/audit.js; nothing here
 * mutates anything - the log is append-only by design, including for admins.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../../prisma');
const query = require('../../lib/query');

const PAGE_SIZE = 50;

router.get('/', async (req, res) => {
    const { action, entityType, entityId, actorId, from, to } = req.query;
    const cursor = query.int(req.query.cursor) ?? null;

    const where = {};
    if (query.str(action)) where.action = query.str(action);
    if (query.str(entityType)) where.entityType = query.str(entityType);
    if (query.int(entityId) !== undefined) where.entityId = query.int(entityId);
    if (query.int(actorId) !== undefined) where.actorId = query.int(actorId);

    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        // `to` is a date the operator picked, meaning "up to the end of that
        // day" - without the bump, filtering to today returns nothing.
        if (to) {
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            where.createdAt.lte = end;
        }
    }

    try {
        const rows = await prisma.auditLog.findMany({
            where,
            orderBy: { id: 'desc' },
            take: PAGE_SIZE + 1, // one extra to detect a further page
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { actor: { select: { id: true, name: true, email: true } } },
        });

        const hasMore = rows.length > PAGE_SIZE;
        const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

        res.json({
            items,
            nextCursor: hasMore ? items[items.length - 1].id : null,
        });
    } catch (error) {
        console.error('Audit read failed:', error);
        res.status(500).json({ error: 'Failed to fetch the audit log.' });
    }
});

// Distinct actions, to populate the filter dropdown with what actually exists
// rather than a hardcoded list that drifts from the code.
router.get('/actions', async (req, res) => {
    try {
        const rows = await prisma.auditLog.groupBy({
            by: ['action'],
            _count: { _all: true },
            orderBy: { action: 'asc' },
        });
        res.json(rows.map((r) => ({ action: r.action, count: r._count._all })));
    } catch (error) {
        console.error('Audit actions failed:', error);
        res.status(500).json({ error: 'Failed to fetch audit actions.' });
    }
});

module.exports = router;
