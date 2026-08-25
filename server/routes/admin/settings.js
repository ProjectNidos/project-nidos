/*
 * Settings that used to be constants in the source. Reads and writes go
 * through server/lib/settings.js, which keeps the old hardcoded values as
 * fallbacks - so an empty table behaves exactly like the code did before.
 */
const express = require('express');
const router = express.Router();
const settings = require('../../lib/settings');
const audit = require('../../lib/audit');
const { LEAD_STATUSES } = require('../../lib/constants');

router.get('/', async (req, res) => {
    try {
        res.json({ values: await settings.all(), defaults: settings.DEFAULTS });
    } catch (error) {
        console.error('Settings read failed:', error);
        res.status(500).json({ error: 'Failed to read settings.' });
    }
});

/*
 * Each key is validated for the shape the code that consumes it expects.
 * Skipping this would let a typo in the admin UI take down the public contact
 * form - which is precisely the failure this setting was extracted to prevent.
 */
function check(key, value) {
    switch (key) {
        case 'gate.enabled':
            return typeof value === 'boolean' ? null : 'Must be true or false.';

        case 'gate.password':
            if (typeof value !== 'string' || !value.length) return 'A password is required.';
            return value.length <= 64 ? null : 'Too long.';

        case 'leads.interestMap': {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return 'Must be a map of form value to CRM category.';
            }
            const bad = Object.entries(value).find(
                ([k, v]) => !k || typeof v !== 'string' || !v
            );
            return bad ? `Invalid entry: ${bad[0]}` : null;
        }

        case 'leads.statuses': {
            if (!Array.isArray(value) || !value.length) return 'At least one status is required.';
            const ids = value.map((s) => s && s.id);
            if (ids.some((id) => !LEAD_STATUSES.includes(id))) {
                // Ids are stored on every Lead row and keyed by crm.css; only
                // the labels are the operator's to change.
                return `Status ids are fixed (${LEAD_STATUSES.join(', ')}). Labels can change.`;
            }
            return null;
        }

        case 'notify.emails': {
            if (!Array.isArray(value)) return 'Must be a list of addresses.';
            const bad = value.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            return bad ? `Not an email address: ${bad}` : null;
        }

        default:
            return 'Unknown setting.';
    }
}

router.put('/', async (req, res) => {
    const updates = req.body && req.body.values;
    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Nothing to save.' });
    }

    for (const [key, value] of Object.entries(updates)) {
        if (!Object.prototype.hasOwnProperty.call(settings.DEFAULTS, key)) {
            return res.status(400).json({ error: `Unknown setting: ${key}` });
        }
        const problem = check(key, value);
        if (problem) return res.status(400).json({ error: `${key}: ${problem}` });
    }

    try {
        const before = await settings.all();

        for (const [key, value] of Object.entries(updates)) {
            await settings.set(key, value, req.user.email);
        }

        const after = await settings.all();
        const changedKeys = Object.keys(updates);

        await audit.record(req, {
            action: 'settings.update',
            entityType: 'Setting',
            summary: `Updated ${changedKeys.join(', ')}`,
            // Only the touched keys, and gate.password is redacted by the audit
            // scrubber before it ever reaches the database.
            before: Object.fromEntries(changedKeys.map((k) => [k, before[k]])),
            after: Object.fromEntries(changedKeys.map((k) => [k, after[k]])),
        });

        res.json({ values: after });
    } catch (error) {
        console.error('Settings save failed:', error);
        res.status(500).json({ error: 'Failed to save settings.' });
    }
});

module.exports = router;
