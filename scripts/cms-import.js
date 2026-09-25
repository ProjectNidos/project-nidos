#!/usr/bin/env node
/*
 * Moves today's pages into the page tables, once.
 *
 *   node scripts/cms-import.js --dev [--replace]   the development database
 *   node scripts/cms-import.js --on-deploy         inside Railway only; see
 *                                                  scripts/deploy-schema.js
 *
 * Home and Services come from their content files, Pricing and the legal pages
 * from their HTML, and every edit saved in the admin's "Site content" tab is
 * applied on top: to the content file for Home and Services, and through
 * server/lib/content.js's own renderer for the HTML pages. Everything is
 * validated before anything is written; one bad block and nothing is.
 * Existing pages are left alone unless --replace is given.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = { key: 'projectnidos', name: 'Project Nidos', domain: 'www.projectnidos.eu' };
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// Every managed page that carries its own saved "Site content" overrides -
// every MANAGED_PAGE in server/lib/content.js except 404.html, which is
// synthetic (conv.convert404()) and has no source page to hold overrides.
const OVERRIDABLE_PAGES = [
    'index.html',
    'nidos/digitalization.html',
    'nidos/pricing.html',
    'nidos/privacy.html',
    'nidos/terms.html',
    'nidos/cookie-policy.html',
    'nidos/gdpr.html',
];

const savedOverrides = async (prisma, page) => (await prisma.siteContent.findMany({ where: { page } }))
    .map(({ key, value }) => ({ key, value }));
// The data-cms keys in the committed file - what the admin's "Site content"
// tab shows for the page, and all the live renderer can place.
const keysOnPage = (content, page) => new Set(content.fields(page).map((f) => f.key));

async function buildPages(prisma, content) {
    const conv = require('./lib/cms-convert');
    // The saved edits are only under their English page names once this has
    // run - before it, the rows stored under 'index.html' are still the old
    // Latvian page's overrides (server/lib/content.js's migrateToEnglishOnly).
    // The server runs the same migration at boot; it is idempotent, so
    // calling it again here just confirms it already happened before any row
    // below is read.
    if (!(await content.ensureMigrated())) {
        throw new Error('import refused: the English-only content migration did not complete, so saved edits cannot be read safely; nothing written');
    }
    // Only the keys today's page still carries. Older versions of a page left
    // rows behind (contact.overline, form.optionEsFondi, ...) that the live
    // renderer skips without a word and the admin no longer lists, so the
    // owner cannot clear them; reportUncarried() names them instead. A key
    // that IS on the page but cannot be placed still stops the import.
    const overrides = async (page) => {
        const onPage = keysOnPage(content, page);
        return (await savedOverrides(prisma, page)).filter((o) => onPage.has(o.key));
    };

    const home = conv.applyOverrides(readJson('site/content.en.json'), await overrides('index.html'));
    const digi = conv.applyOverrides(readJson('site/digi.en.json'), await overrides('nidos/digitalization.html'));
    // content.render(page) is the live site's own renderer: the file plus its
    // saved overrides, exactly as a visitor gets it today.
    const html = (page) => content.render(page);

    const pages = [
        ['/', conv.convertHome(home)],
        ['/nidos/digitalization.html', conv.convertServices(digi)],
        ['/nidos/pricing.html', conv.convertPricing(await html('nidos/pricing.html'))],
        ['/nidos/privacy.html', conv.convertLegal(await html('nidos/privacy.html'))],
        ['/nidos/terms.html', conv.convertLegal(await html('nidos/terms.html'))],
        ['/nidos/cookie-policy.html', conv.convertLegal(await html('nidos/cookie-policy.html'))],
        ['/nidos/gdpr.html', conv.convertLegal(await html('nidos/gdpr.html'))],
        ['/404', conv.convert404()],
    ];
    return { pages, settings: conv.siteSettingsFrom(home) };
}

/*
 * Saved "Site content" edits the block pages do not keep: keys no longer on
 * today's page (see buildPages' overrides()), and share-tag keys (see
 * cms-convert.js's NOT_CARRIED / uncarriedOverrides). Named on the way out,
 * not silently dropped. Reads every page's rows itself, because pricing and
 * the legal pages never fetch their overrides directly - they go through
 * content.render(), which skips a stale key without a word - so this is the
 * only place that looks at their SiteContent rows at all.
 */
async function reportUncarried(prisma, conv, content, log) {
    const notCarried = [];
    for (const page of OVERRIDABLE_PAGES) {
        const rows = await savedOverrides(prisma, page);
        const onPage = keysOnPage(content, page);
        for (const { key } of rows.filter((o) => !onPage.has(o.key))) {
            log.warn(`  ! ${page}: saved "${key}" is not carried over — it is no longer on the page.`);
            notCarried.push(`${page}:${key}`);
        }
        for (const key of conv.uncarriedOverrides(rows.filter((o) => onPage.has(o.key)))) {
            log.warn(`  ! ${page}: saved "${key}" is not carried over — the share tags now use the page's SEO title and description.`);
            notCarried.push(`${page}:${key}`);
        }
    }
    return notCarried;
}

async function runImport({ prisma, replace = false, log = console, deps = {} }) {
    const { validatePage } = require('../server/cms/validate');
    const conv = require('./lib/cms-convert');
    const settings = deps.settings || require('../server/lib/settings');
    const content = deps.content || require('../server/lib/content');
    const audit = deps.audit || require('../server/lib/audit');

    const { pages, settings: siteSettings } = await buildPages(prisma, content);

    const problems = [];
    for (const [p, { page, blocks }] of pages) {
        for (const e of validatePage(page.layout, blocks)) problems.push(`${p} ${e.path}: ${e.message}`);
    }
    const interestMap = (await settings.get('leads.interestMap')) || {};
    for (const [p, { blocks }] of pages) {
        for (const b of blocks.filter((x) => x.type === 'contact-form')) {
            for (const o of b.props.options) {
                if (!Object.prototype.hasOwnProperty.call(interestMap, o.value)) {
                    problems.push(`${p} contact option "${o.value}" is not a CRM lead category (Settings → Contact form categories)`);
                }
            }
        }
    }
    if (problems.length) {
        problems.forEach((x) => log.error('  ✗ ' + x));
        throw new Error(`import refused: ${problems.length} problem(s), nothing written`);
    }

    // Informational only - never adds to `problems`, never stops the import.
    const notCarried = await reportUncarried(prisma, conv, content, log);

    const created = [];
    const skipped = [];
    // One transaction, so a failure part-way leaves nothing behind. The long
    // timeout is for the public connection a local run uses.
    await prisma.$transaction(async (tx) => {
        const site = await tx.site.upsert({ where: { key: SITE.key }, update: {}, create: SITE });
        for (const [key, value] of Object.entries(siteSettings)) {
            const exists = await tx.siteSetting.findUnique({ where: { siteId_key: { siteId: site.id, key } } });
            if (exists && !replace) continue;
            await tx.siteSetting.upsert({
                where: { siteId_key: { siteId: site.id, key } },
                update: { value, updatedBy: 'import' },
                create: { siteId: site.id, key, value, updatedBy: 'import' },
            });
        }
        for (const [p, { page, blocks }] of pages) {
            const existing = await tx.page.findUnique({ where: { siteId_path: { siteId: site.id, path: p } } });
            if (existing && !replace) { skipped.push(p); continue; }
            const data = {
                title: page.title, layout: page.layout, seoTitle: page.seoTitle,
                seoDescription: page.seoDescription, noindex: page.noindex, deletedAt: null,
            };
            const row = existing
                ? await tx.page.update({ where: { id: existing.id }, data })
                : await tx.page.create({ data: { siteId: site.id, path: p, ...data } });
            const version = await tx.pageVersion.create({
                data: { pageId: row.id, kind: 'published', blocks, note: 'Imported from site files' },
            });
            await tx.page.update({ where: { id: row.id }, data: { publishedVersionId: version.id } });
            created.push(p);
        }
    }, { timeout: 60000 });

    if (created.length) {
        await audit.record(null, {
            action: 'cms.import',
            entityType: 'Site',
            summary: `Imported ${created.length} page(s): ${created.join(', ')}${replace ? ' (replace)' : ''}`
                + (notCarried.length ? ` Not carried: ${notCarried.join(', ')}.` : ''),
        });
    }
    log.log(`✓ ${created.length} page(s) written${skipped.length ? `, ${skipped.length} already existed and were left alone` : ''}.`);
    return { created, skipped };
}

module.exports = { runImport };

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--dev')) {
        require('./lib/dev-db').useDevDatabase();
    } else if (args.includes('--on-deploy')) {
        if (!process.env.RAILWAY_ENVIRONMENT_NAME) {
            console.error('✗ --on-deploy runs inside Railway only.');
            process.exit(1);
        }
        require('./env');
    } else {
        console.error('usage: node scripts/cms-import.js --dev [--replace]   (production: RUN_CMS_IMPORT=1 on deploy)');
        process.exit(1);
    }
    const prisma = require('../server/prisma');
    runImport({ prisma, replace: args.includes('--replace') })
        .then(() => prisma.$disconnect())
        .catch(async (err) => {
            console.error('✗ ' + err.message);
            await prisma.$disconnect();
            process.exit(1);
        });
}
