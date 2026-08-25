/*
 * POST /api/import-csv - bulk lead import.
 *
 * The CRM has had an Import CSV button since it was built, pointed at this
 * path, sending a multipart field called `csvFile`. The route was never
 * written, so every import failed. Both the path and the response shape here
 * are dictated by what crm.js already sends and already renders.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../prisma');
const audit = require('../lib/audit');
const { authenticateToken } = require('../middleware/auth');

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const CHUNK = 500;

/* Memory storage, deliberately: the file is parsed and discarded within the
   request, and Railway's filesystem is ephemeral anyway. The size cap is what
   makes holding it in memory safe. */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        const ok = /\.csv$/i.test(file.originalname)
            || ['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype);
        cb(ok ? null : new Error('Only .csv files can be imported.'), ok);
    },
});

/* Header aliases, because these files come from everywhere - a scraper, a
   spreadsheet, someone's export from another CRM. Matching is done on a
   normalised header (lowercased, punctuation stripped) so "Full Name",
   "full_name" and "FULLNAME" all land in the same place. */
const COLUMNS = {
    fullname: 'fullName',
    name: 'fullName',
    contactname: 'fullName',
    companyname: 'fullName',
    company: 'fullName',
    email: 'email',
    emailaddress: 'email',
    mail: 'email',
    phone: 'phone',
    phonenumber: 'phone',
    telephone: 'phone',
    tel: 'phone',
    mobile: 'phone',
    notes: 'notes',
    note: 'notes',
    message: 'notes',
    comment: 'notes',
    description: 'notes',
};

const normalise = (header) => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function mapRow(row) {
    const lead = { fullName: '', email: '', phone: '', notes: '' };
    const extras = [];

    for (const [rawKey, rawValue] of Object.entries(row)) {
        const value = String(rawValue ?? '').trim();
        if (!value) continue;

        const field = COLUMNS[normalise(rawKey)];
        if (field === 'notes') {
            extras.unshift(value); // an explicit notes column leads
        } else if (field) {
            if (!lead[field]) lead[field] = value;
        } else {
            // Unrecognised columns are kept rather than dropped - industry,
            // location, employee count and the like are why the file was
            // bought in the first place.
            extras.push(`${rawKey}: ${value}`);
        }
    }

    lead.notes = extras.join('\n');
    return lead;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', authenticateToken, upload.single('csvFile'), async (req, res) => {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
        return res.status(400).json({ error: 'No CSV file was uploaded.' });
    }

    let rows;
    try {
        rows = parse(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,          // Excel writes one, and it corrupts the first header without this
            relax_column_count: true,
            relax_quotes: true,
        });
    } catch (error) {
        return res.status(400).json({ error: `Could not read the CSV: ${error.message}` });
    }

    if (!rows.length) return res.status(400).json({ error: 'The CSV had no data rows.' });
    if (rows.length > MAX_ROWS) {
        return res.status(400).json({ error: `That file has ${rows.length} rows; the limit is ${MAX_ROWS}.` });
    }

    const errors = [];
    const candidates = [];
    const seenEmails = new Set();

    rows.forEach((row, index) => {
        const line = index + 2; // +1 for the header, +1 for 1-based counting
        const lead = mapRow(row);

        // Same rule as manual entry in server/routes/leads.js: a lead nobody
        // can contact is not a lead.
        if (!lead.email && !lead.phone) {
            errors.push({ line, reason: 'No email or phone' });
            return;
        }
        if (lead.email && !EMAIL.test(lead.email)) {
            errors.push({ line, reason: `Invalid email: ${lead.email}` });
            return;
        }

        const key = lead.email.toLowerCase();
        if (key && seenEmails.has(key)) {
            errors.push({ line, reason: `Duplicate within the file: ${lead.email}` });
            return;
        }
        if (key) seenEmails.add(key);

        candidates.push({ line, lead });
    });

    try {
        // One query for the whole file rather than one per row.
        const emails = candidates.map((c) => c.lead.email).filter(Boolean);
        const existing = emails.length
            ? await prisma.lead.findMany({
                where: { email: { in: emails } },
                select: { email: true },
            })
            : [];
        const already = new Set(existing.map((e) => (e.email || '').toLowerCase()));

        const toCreate = [];
        for (const { line, lead } of candidates) {
            if (lead.email && already.has(lead.email.toLowerCase())) {
                errors.push({ line, reason: `Already in the CRM: ${lead.email}` });
                continue;
            }
            toCreate.push({
                fullName: lead.fullName || lead.email || lead.phone || 'Unknown',
                email: lead.email || null,
                phone: lead.phone || null,
                notes: lead.notes || null,
                /* Not one of the REQUEST_SOURCES, so imported leads show up
                   under Leads without ever appearing in the Incoming Requests
                   inbox - nobody here asked to be contacted. */
                source: 'csv_import',
                status: 'new',
                ownerId: req.user.id,
            });
        }

        let created = 0;
        for (let i = 0; i < toCreate.length; i += CHUNK) {
            const result = await prisma.lead.createMany({ data: toCreate.slice(i, i + CHUNK) });
            created += result.count;
        }

        await audit.record(req, {
            action: 'lead.import',
            entityType: 'Lead',
            summary: `Imported ${created} leads from ${req.file.originalname} (${errors.length} skipped)`,
            after: { file: req.file.originalname, created, skipped: errors.length, totalParsed: rows.length },
        });

        res.json({
            totalParsed: rows.length,
            successCount: created,
            errorCount: errors.length,
            // Enough to act on without shipping back a 5000-line report.
            errors: errors.slice(0, 25),
        });
    } catch (error) {
        console.error('CSV import failed:', error);
        res.status(500).json({ error: 'Failed to import leads.' });
    }
});

/* Multer rejects oversized or non-CSV files by throwing, and Express's default
   handler would answer with an HTML error page that crm.js cannot read. */
router.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `That file is over the ${MAX_BYTES / 1024 / 1024} MB limit.` });
    }
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    next();
});

module.exports = router;
