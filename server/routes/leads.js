const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const prisma = require('../prisma');

// Webhook moved to server/routes/webhooks.js

// Protect all other routes
router.use(authenticateToken);

// List Leads
router.get('/', async (req, res) => {
    const { status, source, q } = req.query;

    const where = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (q) {
        where.OR = [
            { fullName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } }
        ];
    }

    try {
        const leads = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(leads);
    } catch (error) {
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
        res.status(201).json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create lead.' });
    }
});

// Get Lead Detail
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const lead = await prisma.lead.findUnique({
            where: { id: Number(id) },
            include: {
                activities: { orderBy: { createdAt: 'desc' } },
                tasks: { orderBy: { dueDate: 'asc' } }
            }
        });
        if (!lead) return res.status(404).json({ error: 'Lead not found.' });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lead.' });
    }
});

// Update Lead
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { fullName, email, phone, source, status, notes, ownerId } = req.body;

    try {
        const lead = await prisma.lead.update({
            where: { id: Number(id) },
            data: { fullName, email, phone, source, status, notes, ownerId }
        });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update lead.' });
    }
});

// Delete Lead (Admin Only)
router.delete('/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.lead.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lead.' });
    }
});

module.exports = router;
