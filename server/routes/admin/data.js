/*
 * Data tools: export, bulk edits, and the trash.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../../prisma');
const query = require('../../lib/query');
const audit = require('../../lib/audit');
const { LEAD_STATUSES, LIVE } = require('../../lib/constants');

const MAX_BULK = 500;

/* A cell that begins with =, +, - or @ is a formula to Excel and Sheets, which
   will happily execute it on open. Prefixing with an apostrophe makes it text
   again. Tabs and carriage returns get the same treatment because both are
   also honoured as formula starters in some versions. */
function csvCell(value) {
    if (value === null || value === undefined) return '';

    let text = value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

    return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values) {
    return values.map(csvCell).join(',');
}

function sendCsv(res, filename, header, rows) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // A BOM, so Excel opens UTF-8 names (Ričards, Zaļā) correctly instead of
    // as mojibake.
    res.write('﻿');
    res.write(`${csvRow(header)}\n`);
    for (const row of rows) res.write(`${csvRow(row)}\n`);
    res.end();
}

// --- Export -----------------------------------------------------------------

router.get('/export/leads.csv', async (req, res) => {
    const { status, source, q } = req.query;

    // Same filter vocabulary as GET /api/leads, so what you see is what you get.
    const where = { ...LIVE };
    if (query.str(status)) where.status = query.str(status);
    if (query.str(source)) where.source = query.str(source);
    if (q) {
        where.OR = [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
        ];
    }

    try {
        const leads = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { owner: { select: { name: true, email: true } } },
        });

        await audit.record(req, {
            action: 'data.export',
            entityType: 'Lead',
            summary: `Exported ${leads.length} leads to CSV`,
        });

        sendCsv(
            res,
            'nidos-leads.csv',
            ['id', 'fullName', 'email', 'phone', 'source', 'status', 'owner', 'notes', 'createdAt'],
            leads.map((l) => [
                l.id, l.fullName, l.email, l.phone, l.source, l.status,
                l.owner ? l.owner.name || l.owner.email : '',
                l.notes, l.createdAt,
            ])
        );
    } catch (error) {
        console.error('Lead export failed:', error);
        res.status(500).json({ error: 'Failed to export leads.' });
    }
});

router.get('/export/tasks.csv', async (req, res) => {
    try {
        const tasks = await prisma.task.findMany({
            where: LIVE,
            orderBy: { createdAt: 'desc' },
            include: {
                lead: { select: { fullName: true } },
                assignedTo: { select: { name: true, email: true } },
            },
        });

        await audit.record(req, {
            action: 'data.export',
            entityType: 'Task',
            summary: `Exported ${tasks.length} tasks to CSV`,
        });

        sendCsv(
            res,
            'nidos-tasks.csv',
            ['id', 'title', 'status', 'priority', 'dueDate', 'assignedTo', 'lead', 'description', 'createdAt'],
            tasks.map((t) => [
                t.id, t.title, t.status, t.priority, t.dueDate,
                t.assignedTo ? t.assignedTo.name || t.assignedTo.email : '',
                t.lead ? t.lead.fullName : '',
                t.description, t.createdAt,
            ])
        );
    } catch (error) {
        console.error('Task export failed:', error);
        res.status(500).json({ error: 'Failed to export tasks.' });
    }
});

// --- Bulk operations --------------------------------------------------------

router.post('/leads/bulk', async (req, res) => {
    const { action, value } = req.body;
    const ids = Array.isArray(req.body.ids)
        ? req.body.ids.map(Number).filter(Number.isInteger)
        : [];

    if (!ids.length) return res.status(400).json({ error: 'No leads selected.' });
    if (ids.length > MAX_BULK) {
        return res.status(400).json({ error: `Select at most ${MAX_BULK} leads at once.` });
    }

    try {
        let data;
        let summary;

        if (action === 'status') {
            if (!LEAD_STATUSES.includes(value)) {
                return res.status(400).json({ error: 'Unknown status.' });
            }
            data = { status: value };
            summary = `Set ${ids.length} leads to "${value}"`;
        } else if (action === 'owner') {
            const ownerId = value === null || value === '' ? null : Number(value);
            if (ownerId !== null) {
                const owner = await prisma.user.findFirst({
                    where: { id: ownerId, isActive: true },
                });
                if (!owner) return res.status(400).json({ error: 'Unknown or inactive user.' });
            }
            data = { ownerId };
            summary = `Reassigned ${ids.length} leads`;
        } else if (action === 'delete') {
            data = { deletedAt: new Date() };
            summary = `Moved ${ids.length} leads to the trash`;
        } else if (action === 'restore') {
            data = { deletedAt: null };
            summary = `Restored ${ids.length} leads from the trash`;
        } else {
            return res.status(400).json({ error: 'Unknown bulk action.' });
        }

        const result = await prisma.lead.updateMany({ where: { id: { in: ids } }, data });

        await audit.record(req, {
            action: `lead.bulk_${action}`,
            entityType: 'Lead',
            summary,
            after: { ids, ...data },
        });

        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Bulk operation failed:', error);
        res.status(500).json({ error: 'Bulk operation failed.' });
    }
});

// --- Trash ------------------------------------------------------------------

router.get('/trash', async (req, res) => {
    try {
        const [leads, tasks] = await Promise.all([
            prisma.lead.findMany({
                where: { deletedAt: { not: null } },
                orderBy: { deletedAt: 'desc' },
                take: 200,
            }),
            prisma.task.findMany({
                where: { deletedAt: { not: null } },
                orderBy: { deletedAt: 'desc' },
                take: 200,
            }),
        ]);
        res.json({ leads, tasks });
    } catch (error) {
        console.error('Trash read failed:', error);
        res.status(500).json({ error: 'Failed to read the trash.' });
    }
});

router.post('/trash/:type/:id/restore', async (req, res) => {
    const { type } = req.params;
    const id = Number(req.params.id);
    const model = type === 'lead' ? prisma.lead : type === 'task' ? prisma.task : null;

    if (!model || !Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid restore target.' });
    }

    try {
        const restored = await model.update({ where: { id }, data: { deletedAt: null } });
        await audit.record(req, {
            action: `${type}.restore`,
            entityType: type === 'lead' ? 'Lead' : 'Task',
            entityId: id,
            summary: `Restored ${type} #${id}`,
        });
        res.json(restored);
    } catch (error) {
        console.error('Restore failed:', error);
        res.status(500).json({ error: 'Failed to restore.' });
    }
});

/* Purge is the only hard delete left in the application, and it cascades to
   activities and comments. It is admin-only, it is audited with the full record
   so the log still holds what was destroyed, and it refuses anything not
   already in the trash - so a stray call cannot skip the soft-delete step. */
router.delete('/trash/:type/:id', async (req, res) => {
    const { type } = req.params;
    const id = Number(req.params.id);
    const model = type === 'lead' ? prisma.lead : type === 'task' ? prisma.task : null;

    if (!model || !Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid purge target.' });
    }

    try {
        const record = await model.findUnique({ where: { id } });
        if (!record) return res.status(404).json({ error: 'Not found.' });
        if (!record.deletedAt) {
            return res.status(400).json({ error: 'Move it to the trash before purging it.' });
        }

        await model.delete({ where: { id } });

        await audit.record(req, {
            action: `${type}.purge`,
            entityType: type === 'lead' ? 'Lead' : 'Task',
            entityId: id,
            summary: `Permanently deleted ${type} #${id}`,
            before: record,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Purge failed:', error);
        res.status(500).json({ error: 'Failed to purge.' });
    }
});

module.exports = router;
