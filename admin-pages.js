/*
 * admin-pages.js - the admin's Pages section: every page's content, its
 * search-engine texts, and the menu and footer, as forms built from the fields
 * the blocks already declare (docs/superpowers/specs/2026-09-27-page-editor-
 * design.md §3). A save makes a draft; Preview shows the draft on the real
 * page; Publish makes it live. Plain JavaScript, like the rest of the admin.
 *
 * Nothing here is trusted: the server checks every save (server/cms/
 * editor-rules.js). The forms only make the right thing easy.
 */
(() => {
    'use strict';

    const api = window.api;
    const { flash, ask } = window.ui;
    const LINK = /^(\/|#|https?:\/\/|mailto:)/;

    let defs = null;    // GET /api/admin/blocks: every block's fields, the menu and footer's, the categories
    let state = null;   // what is open: { kind: 'page' | 'site', ... }
    let edits = 0;      // changes made since it was opened...
    let savedAt = 0;    // ...and how many of them the last save carried
    let shown = 0;      // bumped on every navigation, so a slow load never draws over a newer view
    let uid = 0;        // for the ids that tie each label to its field
    let saving = Promise.resolve(); // saves run one after another, never two at once

    const root = () => document.getElementById('view-pages');
    const dirty = () => Boolean(state) && edits !== savedAt;
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const fail = (err) => { console.error(err); flash(err && err.message ? err.message : 'Something went wrong.', 'error'); };
    const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

    // A small element builder: text goes in as text, never as markup.
    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v === undefined || v === null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'dataset') Object.assign(el.dataset, v);
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
        return el;
    }

    const header = (title, sub) => h('div', { class: 'crm-header-flex' },
        h('div', {}, h('h1', { class: 'crm-title', text: title }), h('div', { class: 'crm-subtitle', text: sub })));

    function touch() {
        edits += 1;
        const save = root().querySelector('[data-act="save"]');
        if (save) save.classList.add('is-pending');
    }

    // --- The list ------------------------------------------------------------

    async function showList() {
        const me = ++shown;
        state = null;
        const top = header('Pages', 'Edit the words on every page. Changes stay a draft until you publish them.');
        root().replaceChildren(top, h('div', { class: 'crm-empty', text: 'Loading…' }));
        let pages;
        let site;
        try {
            if (!defs) defs = await api.get('/api/admin/blocks');
            [pages, site] = await Promise.all([api.get('/api/admin/pages'), api.get('/api/admin/site')]);
        } catch (err) {
            // Expected before the pages are imported (runbook Step 1); the view offers another go.
            if (me === shown) {
                root().replaceChildren(top, h('div', { class: 'crm-empty' },
                    h('p', { text: err.message || 'The pages could not be loaded.' }),
                    h('button', { class: 'crm-btn-secondary', type: 'button', dataset: { act: 'retry' }, onclick: () => showList() }, 'Try again')));
            }
            return;
        }
        if (me !== shown) return;
        const row = (dataset, title, where, draft, stateText, open) => h('button', {
            class: 'pg-row', type: 'button', dataset, onclick: () => open().catch(fail),
        }, h('span', { class: 'pg-row-title', text: title }), h('span', { class: 'pg-row-path', text: where }),
        h('span', { class: `pg-row-state${draft ? ' is-draft' : ''}`, text: draft ? 'Unpublished changes' : stateText }));
        root().replaceChildren(top, h('div', { class: 'pg-pages' },
            row({ site: '1' }, 'Menu & footer', 'On every page', Boolean(site.draft), 'Published', openSite),
            pages.map((p) => row({ pageId: String(p.id) }, p.title, p.path, p.hasDraft,
                `Published ${day(p.publishedAt)} · ${p.publishedBy}`, () => openPage(p.id)))));
    }

    // --- Opening -------------------------------------------------------------

    async function openPage(id) {
        const me = ++shown;
        const data = await api.get(`/api/admin/pages/${id}`);
        if (me !== shown) return;
        state = { kind: 'page', id, page: data.page, base: data.versionId, hasDraft: data.kind === 'draft', meta: data.meta, blocks: data.blocks };
        renderEditor();
    }

    async function openSite() {
        const me = ++shown;
        const data = await api.get('/api/admin/site');
        if (me !== shown) return;
        state = { kind: 'site', base: data.base, hasDraft: Boolean(data.draft), settings: data.draft || data.live };
        renderEditor();
    }

    const reopen = () => (state.kind === 'page' ? openPage(state.id) : openSite());

    // The title line and the buttons, which change when a first save makes a draft.
    function bars() {
        const page = state.kind === 'page';
        const button = (act, label, run, primary) => h('button', {
            class: primary ? 'crm-btn-primary' : 'crm-btn-secondary', type: 'button', dataset: { act },
            onclick: () => run().catch(fail),
        }, label);
        const sub = (page ? state.page.path : 'On every page') + (state.hasDraft ? ' · unpublished changes' : '');
        const tools = h('div', { class: 'pg-toolbar' },
            button('back', '← All pages', leave),
            h('span', { class: 'pg-spacer' }),
            state.hasDraft ? button('discard', 'Discard changes', discard) : null,
            page ? button('history', 'History', history) : null,
            button('preview', 'Preview', preview),
            button('save', 'Save draft', () => save()),
            button('publish', 'Publish', publish, true));
        if (dirty()) tools.querySelector('[data-act="save"]').classList.add('is-pending');
        return [header(page ? state.page.title : 'Menu & footer', sub), tools];
    }

    function renderEditor() {
        edits = savedAt = 0;
        const body = state.kind === 'page'
            ? [h('section', { class: 'crm-card pg-card pg-card-meta' },
                h('div', { class: 'pg-card-title', text: 'Search engines' }),
                fields(defs.meta, state.meta, 'meta'),
                h('p', { class: 'pg-note', text: 'Google usually shows about 155 characters of the description.' })),
            state.blocks.map((b, i) => {
                const def = defs.blocks[b.type];
                const heading = isObj(b.props) && typeof b.props.heading === 'string' ? ` — ${b.props.heading}` : '';
                return h('section', { class: 'crm-card pg-card', dataset: { block: String(i) } },
                    h('div', { class: 'pg-card-title', text: def.label + heading }),
                    fields(def.fields, b.props, `blocks[${i}]`));
            })]
            : [h('section', { class: 'crm-card pg-card' }, fields(defs.site, state.settings, 'settings'))];
        root().replaceChildren(...bars(), h('div', { class: 'pg-history-host' }), h('div', { class: 'pg-form' }, body));
    }

    // --- The form ------------------------------------------------------------

    function fields(spec, obj, path, attach) {
        return h('div', { class: 'pg-fields' },
            Object.entries(spec).map(([key, f]) => field(f, obj, key, `${path}.${key}`, attach)));
    }

    /* `attach` is for a group that was absent: its fields edit a detached
       object, which joins the page only once something is typed in it - so a
       page opened and saved without edits comes back exactly as it was. */
    function field(f, obj, key, path, attach) {
        if (f.type === 'anchor' && !f.choices) return null; // links point at anchors: kept, never shown
        const set = (v) => { if (attach) attach(); obj[key] = v; touch(); };
        if (f.type === 'group') {
            const target = isObj(obj[key]) ? obj[key] : {};
            const join = () => { if (attach) attach(); if (obj[key] !== target) obj[key] = target; };
            return h('fieldset', { class: 'pg-group', dataset: { field: path } },
                h('legend', { class: 'crm-label', text: f.label + (f.required ? '' : ' (optional)') }),
                fields(f.of, target, path, join), h('div', { class: 'pg-error' }));
        }
        if (f.type === 'list') return listField(f, obj, key, path, attach);
        const id = `pg-f${++uid}`;
        let control;
        if (f.type === 'richtext') control = richBox(f, obj[key], path, set, id);
        else if (f.type === 'select') control = select(f.options, obj[key], path, set, !f.required, id);
        else if (f.choices === 'crm') control = select(defs.categories, obj[key], path, set, false, id);
        else if (f.type === 'date') {
            control = h('input', { id, class: 'crm-input', type: 'date', dataset: { path, kind: 'date' } });
            control.value = obj[key] || '';
            control.addEventListener('input', () => set(control.value));
        } else control = textBox(f, obj[key], path, set, { id });
        // A formatting box is not a form control, so its label names it by id instead.
        return h('div', { class: 'pg-field', dataset: { field: path } },
            h('label', { class: 'crm-label', id: `${id}-label`, for: f.type === 'richtext' ? null : id, text: f.label + (f.required ? '' : ' (optional)') }),
            control, h('div', { class: 'pg-error' }));
    }

    function textBox(f, value, path, set, { id, label } = {}) {
        const multi = f.type === 'longtext';
        const input = h(multi ? 'textarea' : 'input', {
            id,
            'aria-label': label,
            class: multi ? 'crm-textarea' : 'crm-input',
            type: multi ? null : 'text',
            rows: multi ? String(Math.min(10, Math.max(2, Math.ceil(String(value || '').length / 70)))) : null,
            maxlength: f.max ? String(f.max) : null,
            dataset: { path, kind: f.type === 'link' ? 'link' : 'text' },
        });
        input.value = value == null ? '' : String(value);
        const count = f.max ? h('span', { class: 'pg-count' }) : null;
        const update = () => { if (count) count.textContent = `${input.value.length} / ${f.max}`; };
        input.addEventListener('input', () => { update(); set(input.value); });
        update();
        return h('div', { class: 'pg-control' }, input, count,
            f.type === 'link' ? h('span', { class: 'pg-hint', text: 'Starts with /, #, https:// or mailto:' }) : null);
    }

    function select(options, value, path, set, optional, id) {
        const el = h('select', { id, class: 'crm-select', dataset: { path, kind: 'select' } },
            optional ? h('option', { value: '', text: '—' }) : null,
            options.map((o) => h('option', { value: o, text: o })));
        if (value != null && !options.includes(value)) el.append(h('option', { value, text: value }));
        el.value = value == null ? '' : value;
        el.addEventListener('change', () => set(el.value));
        return el;
    }

    // A new item: every field empty, lists at their minimum, choices at their first.
    function blank(of) {
        if (of === 'string') return '';
        const item = {};
        for (const [k, f] of Object.entries(of)) {
            if (f.type === 'list') item[k] = Array.from({ length: f.min || 0 }, () => blank(f.of));
            else if (f.type === 'group') { if (f.required) item[k] = blank(f.of); }
            else if (f.type === 'select' && f.required) item[k] = f.options[0];
            else if (f.choices === 'crm') item[k] = defs.categories[0] || '';
            else item[k] = '';
        }
        return item;
    }

    function listField(f, obj, key, path, attach) {
        const wrap = h('div', { class: 'pg-field pg-listfield', dataset: { field: path } });
        const draw = () => {
            const items = Array.isArray(obj[key]) ? obj[key] : [];
            const changed = () => { if (attach) attach(); obj[key] = items; touch(); draw(); };
            const act = (name, label, disabled, run) => h('button', {
                type: 'button', class: 'crm-btn-mini', 'aria-label': label, title: label, disabled, dataset: { itemAct: name }, onclick: run,
            }, { up: '↑', down: '↓', remove: '✕' }[name]);
            const list = h('div', { class: 'pg-items', dataset: { list: path } }, items.map((item, i) => {
                const at = `${path}[${i}]`;
                const move = (to) => { const [it] = items.splice(i, 1); items.splice(to, 0, it); changed(); };
                const body = f.of === 'string'
                    ? h('div', { class: 'pg-field', dataset: { field: at } },
                        textBox({ type: 'text', max: f.itemMax || 90 }, item, at, (v) => { if (attach) attach(); items[i] = v; obj[key] = items; touch(); },
                            { label: `${f.label}, item ${i + 1}` }),
                        h('div', { class: 'pg-error' }))
                    : fields(f.of, item, at, attach);
                return h('div', { class: 'pg-item', dataset: { index: String(i) } },
                    h('div', { class: 'pg-item-actions' },
                        h('span', { class: 'pg-item-no', text: String(i + 1) }),
                        act('up', `Move item ${i + 1} up`, i === 0, () => move(i - 1)),
                        act('down', `Move item ${i + 1} down`, i === items.length - 1, () => move(i + 1)),
                        act('remove', `Remove item ${i + 1}`, items.length <= (f.min || 0), () => { items.splice(i, 1); changed(); })),
                    body);
            }));
            wrap.replaceChildren(
                h('div', { class: 'crm-label', text: `${f.label} (${f.min || 0}–${f.max})` }),
                list,
                h('button', {
                    type: 'button', class: 'crm-btn-secondary pg-add', disabled: items.length >= f.max,
                    dataset: { listAdd: path }, onclick: () => { items.push(blank(f.of)); changed(); },
                }, '+ Add'),
                h('div', { class: 'pg-error' }));
        };
        draw();
        return wrap;
    }

    // --- The formatting box ----------------------------------------------------

    /* The same allow-list as server/cms/richtext.js, so a box offers only what
       will survive the server's own cleaning - which is the one that counts. */
    const INLINE = new Set(['strong', 'em', 'b', 'i', 'br', 'a', 'span']);
    const FULL = new Set([...INLINE, 'p', 'ul', 'ol', 'li', 'h3', 'h4', 'code', 'address',
        'table', 'thead', 'tbody', 'tr', 'th', 'td']);
    const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'head', 'meta', 'title', 'link']);
    const ATTRS = {
        a: { href: (v) => (LINK.test(v.trim()) ? v.trim() : null) },
        span: { class: (v) => (v.split(/\s+/).includes('key') ? 'key' : null) },
        table: { class: (v) => (v.split(/\s+/).includes('legal-table') ? 'legal-table' : null) },
        th: { scope: (v) => (v === 'col' || v === 'row' ? v : null) },
        td: { 'data-label': (v) => v },
    };

    function cleanNodes(from, into, allowed) {
        for (const node of [...from.childNodes]) {
            if (node.nodeType === Node.TEXT_NODE) { into.append(document.createTextNode(node.textContent)); continue; }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const tag = node.tagName.toLowerCase();
            if (DROP.has(tag)) continue;
            if (!allowed.has(tag)) { cleanNodes(node, into, allowed); continue; }
            const el = document.createElement(tag);
            for (const attr of [...node.attributes]) {
                const rule = (ATTRS[tag] || {})[attr.name.toLowerCase()];
                const kept = rule ? rule(attr.value) : null;
                if (kept != null) el.setAttribute(attr.name.toLowerCase(), kept);
            }
            cleanNodes(node, el, allowed);
            into.append(el);
        }
        return into;
    }

    const clean = (html, full) => cleanNodes(new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body,
        document.createDocumentFragment(), full ? FULL : INLINE);
    const html = (fragment) => { const box = document.createElement('div'); box.append(fragment); return box.innerHTML; };

    function richBox(f, value, path, set, id) {
        const full = f.profile === 'full';
        const area = h('div', {
            class: 'pg-rich', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true',
            'aria-labelledby': `${id}-label`, dataset: { path, kind: 'rich' },
        });
        area.append(clean(value || '', full));
        const changed = () => set(html(clean(area.innerHTML, full)));
        const run = (cmd, arg) => { area.focus(); document.execCommand(cmd, false, arg); changed(); };
        const currentRow = () => {
            const sel = window.getSelection();
            const node = sel && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
            const tr = node && node.closest('tr');
            return tr && area.contains(tr) ? tr : null;
        };
        const tool = (label, title, onclick) => h('button', {
            type: 'button', class: 'crm-btn-mini', title, 'aria-label': title,
            onmousedown: (e) => e.preventDefault(), // keep the selection in the box
            onclick,
        }, label);
        const link = async () => {
            const sel = window.getSelection();
            const range = sel && sel.rangeCount && area.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
            const href = await ask({
                title: 'Link', confirmLabel: 'Apply',
                body: 'Leave the address empty to remove the link.',
                field: { label: 'Address', placeholder: 'https://… or /nidos/pricing.html',
                    validate: (v) => (!v || LINK.test(v.trim()) ? null : 'Start with /, #, https:// or mailto:') },
            });
            if (typeof href !== 'string') return;
            area.focus();
            if (range) { sel.removeAllRanges(); sel.addRange(range); }
            run(href.trim() ? 'createLink' : 'unlink', href.trim() || undefined);
        };
        const tools = [
            tool('B', 'Bold', () => run('bold')),
            tool('I', 'Italic', () => run('italic')),
            tool('Link', 'Link', () => link().catch(fail)),
        ];
        if (full) {
            tools.push(
                tool('• List', 'Bullet list', () => run('insertUnorderedList')),
                tool('1. List', 'Numbered list', () => run('insertOrderedList')),
                tool('Heading', 'Subheading', () => run('formatBlock', document.queryCommandValue('formatBlock') === 'h3' ? 'p' : 'h3')),
                tool('+ Row', 'Add a table row below', () => {
                    const tr = currentRow();
                    if (!tr) return flash('Put the cursor in a table row first.', 'error');
                    const copy = tr.cloneNode(true);
                    copy.querySelectorAll('td, th').forEach((cell) => { cell.textContent = ''; });
                    tr.after(copy);
                    changed();
                }),
                tool('− Row', 'Remove this table row', () => {
                    const tr = currentRow();
                    if (!tr) return flash('Put the cursor in a table row first.', 'error');
                    if (tr.parentElement.children.length > 1) { tr.remove(); changed(); }
                }));
        }
        area.addEventListener('input', changed);
        area.addEventListener('keydown', (e) => {
            // One line break, not a new block, where the box holds a single line of text.
            if (!full && e.key === 'Enter') { e.preventDefault(); run('insertLineBreak'); }
        });
        area.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');
            run('insertHTML', pasted ? html(clean(pasted, full)) : html(clean(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'), full)));
        });
        if (full) document.execCommand('defaultParagraphSeparator', false, 'p');
        const limit = h('span', { class: 'pg-count', text: `up to ${f.max} characters` });
        return h('div', { class: 'pg-control' }, h('div', { class: 'pg-rich-tools' }, tools), area, limit);
    }

    // --- Saving, previewing, publishing --------------------------------------

    function clearErrors() {
        root().querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
        root().querySelectorAll('.pg-error').forEach((el) => { el.textContent = ''; });
    }

    function showErrors(errors) {
        let first = null;
        const unplaced = [];
        for (const { path, message } of errors) {
            const input = root().querySelector(`[data-path="${CSS.escape(path)}"]`);
            const box = (input && input.closest('.pg-field, .pg-group')) || root().querySelector(`[data-field="${CSS.escape(path)}"]`);
            if (!box) { unplaced.push(message); continue; }
            box.classList.add('is-invalid');
            const slot = [...box.children].find((c) => c.classList.contains('pg-error'));
            if (slot) slot.textContent = slot.textContent ? `${slot.textContent} ${message}` : message;
            first = first || box;
        }
        if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        flash(unplaced.length ? unplaced.join(' ') : 'Some fields need attention.', 'error');
    }

    // Saves run one after another: a double-click, or Save then Preview, never sends two at once.
    function save(opts) {
        const run = saving.then(() => saveNow(opts));
        saving = run.catch(() => {});
        return run;
    }

    // Saves the draft. The form stays as it is, so anything typed during the save is kept.
    async function saveNow({ quiet = false } = {}) {
        if (!state) return false;
        if (!dirty() && state.hasDraft) return true; // the save before this one took it all
        clearErrors();
        const upTo = edits;
        try {
            if (state.kind === 'page') {
                const r = await api.put(`/api/admin/pages/${state.id}/draft`, { baseVersionId: state.base, meta: state.meta, blocks: state.blocks });
                state.base = r.versionId;
            } else {
                const r = await api.put('/api/admin/site/draft', { base: state.base, settings: state.settings });
                state.base = r.base;
            }
        } catch (err) {
            if (err.status === 422 && err.data && Array.isArray(err.data.errors)) { showErrors(err.data.errors); return false; }
            if (err.status === 409) { flash(err.message, 'error'); return false; }
            throw err;
        }
        savedAt = upTo;
        state.hasDraft = true;
        const [top, tools] = bars();
        root().querySelector('.crm-header-flex').replaceWith(top);
        root().querySelector('.pg-toolbar').replaceWith(tools);
        if (!quiet) flash('Draft saved.');
        return true;
    }

    async function preview() {
        const path = state.kind === 'site' ? '/' : state.page.path === '/404' ? '/page-not-found' : state.page.path;
        const url = `${path}?__cms=draft`;
        if (!dirty()) { window.open(url, '_blank'); return; }
        // Opened now, while the click still counts as the person's, or the
        // browser blocks it; pointed at the draft once that is saved.
        const tab = window.open('', '_blank');
        if (!(await save({ quiet: true }))) { if (tab) tab.close(); return; }
        if (tab) tab.location.href = url; else window.open(url, '_blank');
    }

    async function publish() {
        if (dirty() && !(await save({ quiet: true }))) return;
        if (!state.hasDraft) { flash('There is nothing to publish: no unpublished changes.'); return; }
        const page = state.kind === 'page';
        const ok = await window.ui.confirm(page ? `Publish ${state.page.title}?` : 'Publish the menu and footer?',
            page ? 'Your draft becomes the live page.' : 'The change reaches every page at once.', { confirmLabel: 'Publish' });
        if (!ok) return;
        if (page) await api.post(`/api/admin/pages/${state.id}/publish`, { baseVersionId: state.base });
        else await api.post('/api/admin/site/publish', { base: state.base });
        flash('Published — live now.');
        await reopen();
    }

    async function discard() {
        const ok = await window.ui.confirm('Discard your changes?', 'The draft is deleted and the form goes back to what is live.',
            { confirmLabel: 'Discard', destructive: true });
        if (!ok) return;
        if (state.kind === 'page') await api.del(`/api/admin/pages/${state.id}/draft`);
        else await api.del('/api/admin/site/draft');
        flash('Changes discarded.');
        await reopen();
    }

    async function history() {
        const list = await api.get(`/api/admin/pages/${state.id}/versions`);
        root().querySelector('.pg-history-host').replaceChildren(h('section', { class: 'crm-card pg-card pg-history' },
            h('div', { class: 'pg-card-title', text: 'Published versions' }),
            h('p', { class: 'pg-note', text: 'Restore copies a version into your draft. Preview it, then publish.' }),
            list.map((v) => h('div', { class: 'pg-history-row', dataset: { versionId: String(v.id) } },
                h('span', { text: `${when(v.createdAt)} · ${v.by}` }),
                v.live ? h('span', { class: 'pg-badge', text: 'Live' })
                    : h('button', { type: 'button', class: 'crm-btn-mini', dataset: { restore: String(v.id) },
                        onclick: () => restore(v.id).catch(fail) }, 'Restore')))));
    }

    async function restore(versionId) {
        if (dirty() && !(await window.ui.confirm('Replace your unsaved changes?', 'Restoring puts that version into your draft.',
            { confirmLabel: 'Restore', destructive: true }))) return;
        await api.post(`/api/admin/pages/${state.id}/versions/${versionId}/restore`, {});
        flash('Restored into your draft. Preview it, then publish.');
        await reopen();
    }

    async function leave() {
        if (dirty() && !(await window.ui.confirm('Leave without saving?', 'Your changes since the last save are lost.',
            { confirmLabel: 'Leave', destructive: true }))) return;
        await showList();
    }

    // Switching admin views keeps this one as it is, so only closing, reloading or signing out can lose a change.
    window.addEventListener('beforeunload', (e) => {
        if (!dirty()) return;
        e.preventDefault();
        e.returnValue = '';
    });

    window.adminPages = {
        load: () => showList(),
        // For sign-out, which cannot wait for a dialog: the browser's own question.
        canLeave: () => {
            if (dirty() && !window.confirm('Leave without saving your changes?')) return false;
            state = null; // asked once: the page's own warning on unload stays quiet
            return true;
        },
    };
})();
