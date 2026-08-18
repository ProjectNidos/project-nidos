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

    /* Keyed on the <select> option VALUES the public form emits, not on its
       labels - the labels are translated per language, the values are not.
       These previously read 'emissions' / 'nidos' / 'digital' / 'bargo' /
       'other', which the form has never sent, so every enquiry landed on the
       'website_form' fallback and the four categories below were unreachable.

       Options deliberately share a category: this is the bucket the CRM
       filters an incoming request by, and the exact wording the person chose
       is preserved verbatim at the head of the notes. */
    const interestMap = {
        'digitalizacija': 'digitalisation',
        'automatizacija': 'digitalisation',
        'es-fondi':       'general',
        'atbilstiba':     'emissions_compliance',
        'cits':           'general'
    };
    // Unknown or absent interest still lands in the inbox - 'website_form' is
    // a REQUEST_SOURCES key, so the enquiry shows up uncategorised, not lost.
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
