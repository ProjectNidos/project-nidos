const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../prisma');

router.use(authenticateToken);

// List Tasks
router.get('/', async (req, res) => {
    const { status, leadId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (leadId) where.leadId = Number(leadId);

    try {
        const tasks = await prisma.task.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            include: {
                lead: { select: { fullName: true } },
                comments: {
                    include: { author: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
});

// Create Task
router.post('/', async (req, res) => {
    const { title, description, status, dueDate, leadId, priority } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required.' });
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
                assignedToId: req.user.id
            }
        });
        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create task.' });
    }
});

// Update Task
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, status, dueDate, leadId, priority, assignedToId } = req.body;

    try {
        const task = await prisma.task.update({
            where: { id: Number(id) },
            data: {
                title,
                description,
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                leadId: leadId ? Number(leadId) : undefined,
                assignedToId
            }
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// Delete Task
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.task.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

module.exports = router;

// Create Comment
router.post('/:id/comments', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'Content is required.' });

    try {
        const comment = await prisma.taskComment.create({
            data: {
                content,
                taskId: Number(id),
                authorId: req.user.id
            },
            include: { author: { select: { name: true, email: true } } }
        });
        res.status(201).json(comment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create comment.' });
    }
});
