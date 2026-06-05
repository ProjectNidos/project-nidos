const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// Public Webhook for Lead Capture (No Auth needed)
// Endpoint: /api/webhooks/form-lead
router.post('/form-lead', async (req, res) => {
    const { name, email, phone, message, interest } = req.body;

    if (!email && !phone) {
        return res.status(400).json({ error: 'At least email or phone is required.' });
    }

    // Map interest to source
    const interestMap = {
        'emissions': 'emissions_compliance',
        'nidos': 'nature_restoration',
        'digital': 'digitalisation',
        'bargo': 'emissions_compliance',
        'other': 'general'
    };
    const source = interestMap[interest] || 'website_form';

    try {
        const lead = await prisma.lead.create({
            data: {
                fullName: name || 'Unknown',
                email: email || null,
                phone: phone || null,
                source: source,
                status: 'new',
                notes: message || ''
            }
        });

        res.status(201).json({ success: true, lead });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Failed to create lead.' });
    }
});

module.exports = router;
