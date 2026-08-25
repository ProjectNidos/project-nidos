/*
 * The dashboard's single payload.
 *
 * One request, one round of queries, because six tiles polling six endpoints
 * is how a dashboard eats a rate limit. Soft-deleted rows are excluded
 * everywhere - a purged-looking lead should not still be inflating the count.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../../prisma');
const query = require('../../lib/query');
const { REQUEST_SOURCES, LIVE } = require('../../lib/constants');

function startOfDayUTC(daysAgo) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
}

/*
 * Prisma's groupBy cannot truncate a timestamp to a day, so the two series are
 * raw SQL. Both are parameterised - `days` is coerced to an integer before it
 * is ever near the query, and the interval is bound, not interpolated.
 *
 * generate_series fills the empty days: without it a quiet week draws as a
 * straight line between two distant points rather than as a floor of zeroes.
 */
async function leadSeries(since) {
    return prisma.$queryRaw`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
               COUNT(l.id)::int             AS count
        FROM generate_series(${since}::timestamp, NOW(), '1 day') AS d(day)
        LEFT JOIN "Lead" l
               ON date_trunc('day', l."createdAt") = date_trunc('day', d.day)
              AND l."deletedAt" IS NULL
        GROUP BY d.day
        ORDER BY d.day ASC`;
}

async function taskSeries(since) {
    return prisma.$queryRaw`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
               COUNT(t.id)::int             AS count
        FROM generate_series(${since}::timestamp, NOW(), '1 day') AS d(day)
        LEFT JOIN "Task" t
               ON date_trunc('day', t."updatedAt") = date_trunc('day', d.day)
              AND t.status = 'done'
              AND t."deletedAt" IS NULL
        GROUP BY d.day
        ORDER BY d.day ASC`;
}

router.get('/', async (req, res) => {
    // Clamped: an unbounded `days` is an unbounded generate_series.
    const days = query.intIn(req.query.days, 30, 1, 365);
    const since = startOfDayUTC(days - 1);
    const now = new Date();

    try {
        const [
            totalLeads,
            leadsThisPeriod,
            activeUsers,
            openTasks,
            overdueTasks,
            byStatus,
            bySource,
            unhandled,
            oldestUnhandled,
        ] = await Promise.all([
            prisma.lead.count({ where: LIVE }),
            prisma.lead.count({ where: { ...LIVE, createdAt: { gte: since } } }),
            prisma.user.count({ where: { isActive: true } }),
            prisma.task.count({ where: { ...LIVE, status: { not: 'done' } } }),
            prisma.task.count({
                where: { ...LIVE, status: { not: 'done' }, dueDate: { lt: now } },
            }),
            prisma.lead.groupBy({ by: ['status'], where: LIVE, _count: { _all: true } }),
            prisma.lead.groupBy({ by: ['source'], where: LIVE, _count: { _all: true } }),
            prisma.lead.count({
                where: { ...LIVE, status: 'new', source: { in: REQUEST_SOURCES } },
            }),
            prisma.lead.findFirst({
                where: { ...LIVE, status: 'new', source: { in: REQUEST_SOURCES } },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            }),
        ]);

        const [leadsPerDay, tasksPerDay] = await Promise.all([
            leadSeries(since),
            taskSeries(since),
        ]);

        const counted = (rows, key) =>
            rows.map((r) => ({ [key]: r[key], count: r._count._all }))
                .sort((a, b) => b.count - a.count);

        const statusCount = Object.fromEntries(
            byStatus.map((r) => [r.status, r._count._all])
        );
        const won = statusCount.won || 0;
        const lost = statusCount.lost || 0;
        const closed = won + lost;

        res.json({
            days,
            totals: {
                leads: totalLeads,
                leadsThisPeriod,
                users: activeUsers,
                openTasks,
                overdueTasks,
            },
            byStatus: counted(byStatus, 'status'),
            bySource: counted(bySource, 'source'),
            leadsPerDay,
            tasksPerDay,
            conversion: {
                won,
                lost,
                closed,
                // Of the leads that reached a verdict, how many said yes. Leads
                // still in the pipeline are excluded rather than counted as
                // losses, which would make a busy month look like a bad one.
                winRate: closed ? Math.round((won / closed) * 100) : null,
                openPipeline: totalLeads - closed,
            },
            requests: {
                unhandled,
                oldestUnhandledAt: oldestUnhandled ? oldestUnhandled.createdAt : null,
            },
        });
    } catch (error) {
        console.error('Stats failed:', error);
        res.status(500).json({ error: 'Failed to build dashboard statistics.' });
    }
});

module.exports = router;
