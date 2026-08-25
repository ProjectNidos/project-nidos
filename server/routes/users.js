/*
 * The colleague list, for assignee and owner dropdowns.
 *
 * Deliberately not under /api/admin: any signed-in user needs it to assign a
 * task, and until it existed Task.assignedToId could only ever be the creator
 * (server/routes/tasks.js sets it from req.user). Returns nothing but a name
 * and an id - the admin panel is where user detail lives.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../prisma');

router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const list = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: [{ name: 'asc' }, { email: 'asc' }],
        });
        res.json(list);
    } catch (error) {
        console.error('User list failed:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

module.exports = router;
