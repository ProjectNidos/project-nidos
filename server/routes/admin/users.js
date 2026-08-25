/*
 * User administration.
 *
 * Two rules run through every handler here, and both exist to stop an admin
 * locking the team out of its own CRM:
 *   1. You cannot demote, deactivate or delete yourself.
 *   2. The last active admin cannot be demoted or deactivated by anyone.
 * Without them the only way back in is scripts/seed-admin.js and a terminal,
 * which is the exact situation this panel was built to end.
 *
 * Accounts are never hard-deleted: Lead.ownerId and Task.assignedToId point at
 * them.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../../prisma');
const audit = require('../../lib/audit');
const users = require('../../lib/users');

// List
router.get('/', async (req, res) => {
    try {
        const rows = await prisma.user.findMany({
            select: {
                ...users.PUBLIC_FIELDS,
                _count: { select: { leads: true, tasks: true } },
            },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        });
        res.json(rows);
    } catch (error) {
        console.error('User list failed:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// Create
router.post('/', async (req, res) => {
    try {
        const user = await users.create(req.body);
        await audit.record(req, {
            action: 'user.create',
            entityType: 'User',
            entityId: user.id,
            summary: `Created ${user.role} ${user.email}`,
            after: user,
        });
        res.status(201).json(user);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('User create failed:', error);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

// Update name / role / isActive
router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id.' });

    const { name, role, isActive } = req.body;

    const problem = users.validate({ role }, { requirePassword: false });
    if (problem) return res.status(400).json({ error: problem });

    try {
        const before = await prisma.user.findUnique({ where: { id }, select: users.PUBLIC_FIELDS });
        if (!before) return res.status(404).json({ error: 'User not found.' });

        const losingAdmin = (role !== undefined && role !== 'admin' && before.role === 'admin')
            || (isActive === false && before.isActive && before.role === 'admin');

        if (id === req.user.id && (role !== undefined && role !== before.role)) {
            return res.status(400).json({ error: 'You cannot change your own role.' });
        }
        if (id === req.user.id && isActive === false) {
            return res.status(400).json({ error: 'You cannot deactivate your own account.' });
        }
        if (losingAdmin && (await users.activeAdminCount(id)) === 0) {
            return res.status(400).json({
                error: 'This is the last active admin. Promote someone else first.',
            });
        }

        const data = {};
        if (name !== undefined) data.name = name ? String(name).trim() : null;
        if (role !== undefined) data.role = role;
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        if (!Object.keys(data).length) {
            return res.status(400).json({ error: 'Nothing to update.' });
        }

        const after = await prisma.user.update({ where: { id }, data, select: users.PUBLIC_FIELDS });

        const changes = audit.diff(before, after, ['name', 'role', 'isActive']);
        if (changes) {
            await audit.record(req, {
                action: 'user.update',
                entityType: 'User',
                entityId: id,
                summary: `Updated ${after.email}: ${Object.keys(changes.after).join(', ')}`,
                ...changes,
            });
        }

        res.json(after);
    } catch (error) {
        console.error('User update failed:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

// Admin-set password reset
router.post('/:id/password', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id.' });

    const { password } = req.body;
    const problem = users.validate({ password });
    if (problem) return res.status(400).json({ error: problem });

    try {
        const user = await prisma.user.findUnique({ where: { id }, select: users.PUBLIC_FIELDS });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await prisma.user.update({
            where: { id },
            data: { password: await users.hash(password) },
        });

        // No before/after here on purpose - neither hash belongs in a log.
        await audit.record(req, {
            action: 'user.password_reset',
            entityType: 'User',
            entityId: id,
            summary: `Reset the password for ${user.email}`,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Password reset failed:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});

module.exports = router;
