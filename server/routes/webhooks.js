const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const settings = require('../lib/settings');

// Public Webhook for Lead Capture (No Auth needed)
// Endpoint: /api/webhooks/form-lead
//
// Two kinds of caller. The site's contact form sends JSON from contact-form.js
// and reads the reply itself. A browser without that script posts the form
// the plain way, url-encoded - server.js parses only JSON, so without the
// parser here every such enquiry arrived empty and was refused.
router.post('/form-lead', express.urlencoded({ extended: false, limit: '100kb' }), async (req, res) => {
    // A plain post navigated the browser here, so every answer to it is a
    // page: back to the form, or a sentence - never a page of JSON.
    // ponytail: no "sent" message without the script; add a thank-you page if that ever matters.
    const fromBrowser = req.is('urlencoded');
    const { name, email, phone, message, interest } = req.body;

    if (!email && !phone) {
        if (fromBrowser) return res.redirect(303, '/#contact');
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

        if (fromBrowser) return res.redirect(303, '/#contact');
        res.status(201).json({ success: true, lead });
    } catch (error) {
        console.error('Webhook error:', error);
        if (fromBrowser) return res.status(500).type('text').send('Your message could not be sent. Please go back and try again later.');
        res.status(500).json({ error: 'Failed to create lead.' });
    }
});

module.exports = router;
