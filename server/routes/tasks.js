const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../prisma');
const audit = require('../lib/audit');
const { LIVE, TASK_STATUSES } = require('../lib/constants');
const query = require('../lib/query');

router.use(authenticateToken);

// List Tasks
router.get('/', async (req, res) => {
    /* query.str / query.int: see server/lib/query.js - a nested query value
       is an object, which Prisma reads as an operator and Number() cannot
       coerce without throwing. */
    const status = query.str(req.query.status);
    const leadId = query.int(req.query.leadId);
    const assignedToId = query.int(req.query.assignedToId);

    const where = { ...LIVE };
    if (status) where.status = status;
    if (leadId !== undefined) where.leadId = leadId;
    if (assignedToId !== undefined) where.assignedToId = assignedToId;

    try {
        const tasks = await prisma.task.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            include: {
                lead: { select: { fullName: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                comments: {
                    include: { author: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        res.json(tasks);
    } catch (error) {
        console.error('Task list failed:', error);
        res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
});

// Create Task
router.post('/', async (req, res) => {
    const { title, description, status, dueDate, leadId, priority, assignedToId } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required.' });
    }

    /* The kanban matches status exactly and has no fallback column, so an
       unrecognised value does not render anywhere - the task simply vanishes
       from every board while still counting as open on the admin dashboard.
       Same allowlist the leads route applies to Lead.status. */
    if (status !== undefined && status !== null && !TASK_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
    }

    try {
        const task = await prisma.task.create({
            data: {
                title,
                description,
                status: status || 'todo',
                priority,
                dueDate: dueDate ? new Date(dueDate) : null,
                leadId: leadId ? Number(leadId) : null,
                // Still defaults to the creator, but an explicit assignee is
                // now possible - the CRM has a colleague list to pick from.
                assignedToId: assignedToId ? Number(assignedToId) : req.user.id
            }
        });

        await audit.record(req, {
            action: 'task.create',
            entityType: 'Task',
            entityId: task.id,
            summary: `Created task "${task.title}"`,
            after: task
        });

        res.status(201).json(task);
    } catch (error) {
        console.error('Task create failed:', error);
        res.status(500).json({ error: 'Failed to create task.' });
    }
});

// Update Task
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { title, description, status, dueDate, leadId, priority, assignedToId } = req.body;

    /* The kanban matches status exactly and has no fallback column, so an
       unrecognised value does not render anywhere - the task simply vanishes
       from every board while still counting as open on the admin dashboard.
       Same allowlist the leads route applies to Lead.status. */
    if (status !== undefined && status !== null && !TASK_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
    }

    try {
        const before = await prisma.task.findFirst({ where: { id, ...LIVE } });
        if (!before) return res.status(404).json({ error: 'Task not found.' });

        const after = await prisma.task.update({
            where: { id },
            data: {
                title,
                description,
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                leadId: leadId ? Number(leadId) : undefined,
                // `undefined` leaves it alone; null clears it deliberately.
                assignedToId: assignedToId === undefined
                    ? undefined
                    : (assignedToId === null || assignedToId === '' ? null : Number(assignedToId))
            }
        });

        const changes = audit.diff(before, after, [
            'title', 'description', 'status', 'priority', 'dueDate', 'leadId', 'assignedToId'
        ]);
        if (changes) {
            await audit.record(req, {
                action: status && status !== before.status ? 'task.status' : 'task.update',
                entityType: 'Task',
                entityId: id,
                summary: `Updated "${after.title}": ${Object.keys(changes.after).join(', ')}`,
                ...changes
            });
        }

        res.json(after);
    } catch (error) {
        console.error('Task update failed:', error);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// Delete Task (soft - restorable from the admin trash)
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        const before = await prisma.task.findFirst({ where: { id, ...LIVE } });
        if (!before) return res.status(404).json({ error: 'Task not found.' });

        await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });

        await audit.record(req, {
            action: 'task.delete',
            entityType: 'Task',
            entityId: id,
            summary: `Moved task "${before.title}" to the trash`,
            before
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Task delete failed:', error);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

// Create Comment
router.post('/:id/comments', async (req, res) => {
    const id = Number(req.params.id);
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'Content is required.' });

    try {
        const task = await prisma.task.findFirst({ where: { id, ...LIVE } });
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const comment = await prisma.taskComment.create({
            data: {
                content,
                taskId: id,
                authorId: req.user.id
            },
            include: { author: { select: { name: true, email: true } } }
        });

        await audit.record(req, {
            action: 'task.comment',
            entityType: 'Task',
            entityId: id,
            summary: `Commented on "${task.title}"`
        });

        res.status(201).json(comment);
    } catch (error) {
        console.error('Comment create failed:', error);
        res.status(500).json({ error: 'Failed to create comment.' });
    }
});

module.exports = router;
