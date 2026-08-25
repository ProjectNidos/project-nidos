const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const prisma = require('../prisma');
const audit = require('../lib/audit');
const { LIVE, REQUEST_SOURCES, LEAD_STATUSES } = require('../lib/constants');
const query = require('../lib/query');

// Webhook moved to server/routes/webhooks.js

// Protect all other routes
router.use(authenticateToken);

const DEFAULT_TAKE = 100;
const MAX_TAKE = 500;

// List Leads
router.get('/', async (req, res) => {
    /* Read through query.str: a nested query like ?status[contains]=x parses
       to an object, which would reach Prisma as a filter operator - and which
       String() cannot coerce without throwing. See server/lib/query.js. */
    const status = query.str(req.query.status);
    const source = query.str(req.query.source);
    const q = query.str(req.query.q);

    // Soft-deleted leads are invisible everywhere except the admin trash.
    const where = { ...LIVE };
    if (status) where.status = status;
    if (source) where.source = source;
    if (q) {
        where.OR = [
            // `mode` is Postgres-only, and Postgres is what this runs on. It
            // matters: without it a search for "Anna" misses "anna@..." .
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } }
        ];
    }

    /* Cursor pagination. This used to return every row in the table, which was
       fine at a few hundred leads and stops being fine somewhere below the
       first CSV import. Callers that ignore the new shape still work: the
       response is an object, and crm.js reads `items`. */
    const take = query.intIn(req.query.take, DEFAULT_TAKE, 1, MAX_TAKE);
    const cursor = query.int(req.query.cursor) ?? null;

    try {
        const [rows, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { id: 'desc' },
                take: take + 1,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                include: { owner: { select: { id: true, name: true, email: true } } }
            }),
            prisma.lead.count({ where })
        ]);

        const hasMore = rows.length > take;
        const items = hasMore ? rows.slice(0, take) : rows;

        res.json({
            items,
            total,
            nextCursor: hasMore ? items[items.length - 1].id : null
        });
    } catch (error) {
        console.error('Lead list failed:', error);
        res.status(500).json({ error: 'Failed to fetch leads.' });
    }
});

// Create Lead (Internal)
router.post('/', async (req, res) => {
    const { fullName, email, phone, source, notes } = req.body;

    if (!email && !phone) {
        return res.status(400).json({ error: 'At least email or phone is required.' });
    }

    try {
        const lead = await prisma.lead.create({
            data: {
                fullName,
                email,
                phone,
                source: source || 'manual',
                notes,
                ownerId: req.user.id
            }
        });

        await audit.record(req, {
            action: 'lead.create',
            entityType: 'Lead',
            entityId: lead.id,
            summary: `Created lead ${lead.fullName || lead.email || `#${lead.id}`}`,
            after: lead
        });

        res.status(201).json(lead);
    } catch (error) {
        console.error('Lead create failed:', error);
        res.status(500).json({ error: 'Failed to create lead.' });
    }
});

/* The Incoming Requests inbox.
   It used to be derived client-side from the full leads list, which worked
   only because that list was unpaginated. Now that it is paged, an enquiry
   older than the newest page would silently vanish from the inbox - so the
   inbox asks for exactly what it shows. Declared before /:id, or Express reads
   "requests" as an id. */
router.get('/requests', async (req, res) => {
    const where = {
        ...LIVE,
        source: { in: REQUEST_SOURCES },
        ...(req.query.all === '1' ? {} : { status: 'new' })
    };

    try {
        const requests = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        const unhandled = req.query.all === '1'
            ? await prisma.lead.count({ where: { ...LIVE, source: { in: REQUEST_SOURCES }, status: 'new' } })
            : requests.length;

        res.json({ items: requests, unhandled });
    } catch (error) {
        console.error('Request inbox failed:', error);
        res.status(500).json({ error: 'Failed to fetch requests.' });
    }
});

// Get Lead Detail
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const lead = await prisma.lead.findFirst({
            where: { id: Number(id), ...LIVE },
            include: {
                activities: {
                    orderBy: { createdAt: 'desc' },
                    include: { createdBy: { select: { name: true, email: true } } }
                },
                tasks: { where: LIVE, orderBy: { dueDate: 'asc' } },
                owner: { select: { id: true, name: true, email: true } }
            }
        });
        if (!lead) return res.status(404).json({ error: 'Lead not found.' });
        res.json(lead);
    } catch (error) {
        console.error('Lead read failed:', error);
        res.status(500).json({ error: 'Failed to fetch lead.' });
    }
});

// Update Lead
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { fullName, email, phone, source, status, notes, ownerId } = req.body;

    /* status is rendered into the leads table and the request inbox, and any
       authenticated user can write to any lead here. Allowlist it at the door
       the way the bulk action in admin/data.js already does - an unrecognised
       value has no meaning to the CRM anyway, and a free-form one is a script
       waiting for an admin to open the page. */
    if (status !== undefined && !LEAD_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
    }

    try {
        const before = await prisma.lead.findFirst({ where: { id, ...LIVE } });
        if (!before) return res.status(404).json({ error: 'Lead not found.' });

        const after = await prisma.lead.update({
            where: { id },
            data: { fullName, email, phone, source, status, notes, ownerId }
        });

        /* A status change is the event the CRM cares about, so it gets a
           LeadActivity of its own as well as an audit row. The model has been
           in the schema since day one with nothing ever writing to it, which is
           why a lead's history was blank however many times it moved. */
        if (status && status !== before.status) {
            await prisma.leadActivity.create({
                data: {
                    type: 'status_change',
                    content: `${before.status} → ${status}`,
                    leadId: id,
                    createdById: req.user.id
                }
            }).catch((err) => console.error('Activity write failed:', err.message));
        }

        const changes = audit.diff(before, after, [
            'fullName', 'email', 'phone', 'source', 'status', 'notes', 'ownerId'
        ]);
        if (changes) {
            await audit.record(req, {
                action: status && status !== before.status ? 'lead.status' : 'lead.update',
                entityType: 'Lead',
                entityId: id,
                summary: `Updated ${after.fullName || `lead #${id}`}: ${Object.keys(changes.after).join(', ')}`,
                ...changes
            });
        }

        res.json(after);
    } catch (error) {
        console.error('Lead update failed:', error);
        res.status(500).json({ error: 'Failed to update lead.' });
    }
});

/* Delete is a soft delete now. The record keeps its activities and its tasks,
   the audit trail keeps pointing at something that exists, and an accident is
   undoable from the admin panel's trash. Purging for real lives there too, and
   is admin-only. */
router.delete('/:id', isAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const before = await prisma.lead.findFirst({ where: { id, ...LIVE } });
        if (!before) return res.status(404).json({ error: 'Lead not found.' });

        await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });

        await audit.record(req, {
            action: 'lead.delete',
            entityType: 'Lead',
            entityId: id,
            summary: `Moved ${before.fullName || `lead #${id}`} to the trash`,
            before
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Lead delete failed:', error);
        res.status(500).json({ error: 'Failed to delete lead.' });
    }
});

module.exports = router;
