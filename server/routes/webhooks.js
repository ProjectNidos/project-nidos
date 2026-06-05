const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const nodemailer = require('nodemailer');

// Email transporter (configured via env vars)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
        user: process.env.SMTP_USER || 'support@projectnidos.eu',
        pass: process.env.SMTP_PASS || ''
    }
});

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

        // Send email notification
        const interestLabels = {
            'emissions': 'ES Emisiju Atbilstība (unbin.io)',
            'nidos': 'ES Dabas Atjaunošanas Regula',
            'digital': 'Uzņēmumu Digitalizācija',
            'bargo': 'ES Emisiju Atbilstība (bargo.lv)',
            'other': 'Cits jautājums'
        };
        const interestLabel = interestLabels[interest] || interest || 'Nav norādīts';

        try {
            await transporter.sendMail({
                from: `"Project Nidos" <${process.env.SMTP_USER || 'support@projectnidos.eu'}>`,
                to: 'support@projectnidos.eu, nidos@bargo.lv',
                subject: `Jauns pieprasījums: ${interestLabel} — ${name || 'Anonīms'}`,
                html: `
                    <h2>Jauns pieprasījums no mājaslapas</h2>
                    <table style="border-collapse:collapse;width:100%;max-width:600px;">
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Vārds</td><td style="padding:8px;border-bottom:1px solid #eee;">${name || '—'}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">E-pasts</td><td style="padding:8px;border-bottom:1px solid #eee;">${email || '—'}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Tālrunis</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone || '—'}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Interese</td><td style="padding:8px;border-bottom:1px solid #eee;">${interestLabel}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Ziņa</td><td style="padding:8px;border-bottom:1px solid #eee;">${message || '—'}</td></tr>
                    </table>
                `
            });
            console.log('Email sent for lead:', lead.id);
        } catch (emailError) {
            console.error('Email failed (lead saved to DB):', emailError.message);
        }

        res.status(201).json({ success: true, lead });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Failed to create lead.' });
    }
});

module.exports = router;
