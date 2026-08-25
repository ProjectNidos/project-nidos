/*
 * Shared vocabulary. These strings are written into the database, so they are
 * not free to change - each one is matched somewhere in the frontend too.
 */

/* Sources the public form webhook writes. The CRM's Incoming Requests inbox is
   defined as "a lead whose source is one of these" (see REQUEST_SOURCES in
   crm.js, which must stay in step). A manually-entered or CSV-imported lead is
   deliberately outside the set: it is a lead, but nobody asked us to call them. */
const REQUEST_SOURCES = [
    'website_form',
    'emissions_compliance',
    'nature_restoration',
    'digitalisation',
    'general',
];

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'];

const TASK_STATUSES = ['todo', 'in_progress', 'done'];

// Rows that have not been soft-deleted. Spread into a Prisma `where`.
const LIVE = { deletedAt: null };

module.exports = { REQUEST_SOURCES, LEAD_STATUSES, TASK_STATUSES, LIVE };
