const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const settings = require('../lib/settings');

// Public Webhook for Lead Capture (No Auth needed)
// Endpoint: /api/webhooks/form-lead
router.post('/form-lead', async (req, res) => {
    const { name, email, phone, message, interest } = req.body;

    if (!email && !phone) {
        return res.status(400).json({ error: 'At least email or phone is required.' });
    }

    /* Keyed on the <select> option VALUES the public form emits, not on its
       labels - the labels are translated per language, the values are not.

       This map used to be a constant here and drifted out of step with the
       form, so every enquiry silently landed on the 'website_form' fallback and
       four categories were unreachable. It now lives in Settings, where it is
       visible and editable next to the form values it has to match.

       Options deliberately share a category: this is the bucket the CRM filters
       an incoming request by, and the exact wording the person chose is
       preserved verbatim at the head of the notes. */
    const interestMap = (await settings.get('leads.interestMap')) || {};

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
