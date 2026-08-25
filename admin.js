/*
 * Admin panel.
 *
 * The server is the only thing enforcing anything here: every /api/admin call
 * is checked for an active admin session. The role check below exists so a
 * non-admin who follows a link gets sent somewhere useful instead of six empty
 * panels and a wall of 403s.
 *
 * Views load on first open, not on boot - the dashboard should not wait for
 * the audit log.
 */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const esc = window.fmt.esc;
    const api = window.api;

    let me = null;
    const loaded = {};       // view -> true once its first fetch has run
    let usersCache = [];

    // --- Chrome ------------------------------------------------------------

    /* The dialog, the toast and the skeletons are shared with the CRM - see
       ui.js. They used to live here, which meant a confirmation looked one way
       in the admin panel and another way one click into the CRM. */
    const flash = window.ui.flash;
    const ask = window.ui.ask;
    const skeleton = window.ui.skeleton;

    function fail(err) {
        console.error(err);
        flash(err && err.message ? err.message : 'Something went wrong.', 'error');
    }

    const views = {
        dashboard: loadDashboard,
        users: loadUsers,
        content: loadContentPages,
        audit: loadAudit,
        data: loadData,
        settings: loadSettings,
    };

    function showView(name) {
        document.querySelectorAll('.crm-nav-item[data-view]').forEach((item) => {
            item.classList.toggle('active', item.getAttribute('data-view') === name);
        });
        document.querySelectorAll('.crm-view').forEach((view) => {
            view.classList.toggle('active', view.id === 'view-' + name);
        });

        if (!loaded[name] && views[name]) {
            loaded[name] = true;
            views[name]().catch(fail);
        }
    }

    /* A div is not a button. These are focusable, so Enter and Space have to
       land where a click lands - otherwise the focus ring leads nowhere. */
    function activate(el, run) {
        el.addEventListener('click', run);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); }
        });
    }

    document.querySelectorAll('.crm-nav-item[data-view]').forEach((item) => {
        activate(item, () => showView(item.getAttribute('data-view')));
    });

    activate(document.getElementById('logout-btn'), () => api.logout());

    // --- Boot --------------------------------------------------------------

    (async function boot() {
        try {
            me = await api.get('/api/auth/me');
        } catch (err) {
            return; // api.js has already sent an expired session to the login page
        }

        if (me.role !== 'admin') {
            window.location.href = 'crm.html';
            return;
        }

        document.getElementById('user-display').textContent = me.name || me.email;
        showView('dashboard');
    }());

    /* ======================================================================
     * Dashboard
     * ==================================================================== */

    const STATUS_ORDER = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'];
    const STATUS_COLOUR = {
        new: 'var(--c-new)',
        contacted: 'var(--c-contacted)',
        qualified: 'var(--c-qualified)',
        proposal_sent: 'var(--c-proposal)',
        won: 'var(--c-won)',
        lost: 'var(--c-lost)',
    };

    let statsDays = 30;

    document.getElementById('range-control').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-days]');
        if (!btn) return;
        statsDays = Number(btn.getAttribute('data-days'));
        document.querySelectorAll('#range-control button').forEach((b) => {
            b.classList.toggle('active', b === btn);
        });
        loadDashboard().catch(fail);
    });

    async function loadDashboard() {
        const strip = document.getElementById('metric-strip');
        if (!strip.dataset.loaded) {
            strip.innerHTML = Array.from({ length: 6 },
                () => '<div class="metric"><div class="skeleton skeleton-tile"></div></div>').join('');
            document.getElementById('pipeline-bar').innerHTML = '<div class="skeleton skeleton-bar" style="width:100%"></div>';
            document.getElementById('source-ranks').innerHTML = skeleton.rows(4);
        }

        const stats = await api.get('/api/admin/stats?days=' + statsDays);
        strip.dataset.loaded = '1';
        renderMetrics(stats);
        renderPipeline(stats);
        renderRanks(stats.bySource);
        renderBars(document.getElementById('leads-chart'), stats.leadsPerDay);
        renderArea(document.getElementById('tasks-chart'), stats.tasksPerDay);

        const total = stats.leadsPerDay.reduce((sum, d) => sum + d.count, 0);
        document.getElementById('leads-chart-note').textContent =
            total + (total === 1 ? ' lead' : ' leads') + ' in ' + stats.days + ' days';

        const done = stats.tasksPerDay.reduce((sum, d) => sum + d.count, 0);
        document.getElementById('tasks-chart-note').textContent =
            done + ' finished';
    }

    function metric(value, label, opts) {
        const o = opts || {};
        return '<div class="metric ' + (o.className || '') + '"' +
            (o.href ? ' data-href="' + esc(o.href) + '" role="link" tabindex="0"' : '') + '>' +
            '<div class="metric-value">' + esc(value) + '</div>' +
            '<div class="metric-label">' + esc(label) + '</div>' +
            (o.note ? '<div class="metric-note">' + esc(o.note) + '</div>' : '') +
            '</div>';
    }

    function renderMetrics(stats) {
        const t = stats.totals;
        const oldest = stats.requests.oldestUnhandledAt;

        const strip = document.getElementById('metric-strip');
        strip.innerHTML = [
            metric(t.leads, 'Leads', { note: '+' + t.leadsThisPeriod + ' in ' + stats.days + ' days' }),
            metric(
                stats.requests.unhandled,
                'Waiting on a reply',
                {
                    className: stats.requests.unhandled ? 'is-live is-link' : 'is-link',
                    href: 'crm.html#requests',
                    note: oldest ? 'oldest ' + window.fmt.timeAgo(oldest) : 'inbox is clear',
                }
            ),
            metric(
                stats.conversion.winRate === null ? '—' : stats.conversion.winRate + '%',
                'Win rate',
                { note: stats.conversion.won + ' won of ' + stats.conversion.closed + ' decided' }
            ),
            metric(t.openTasks, 'Open tasks', { className: 'is-link', href: 'crm.html#tasks' }),
            metric(t.overdueTasks, 'Overdue', { className: t.overdueTasks ? 'is-alert' : '' }),
            metric(t.users, 'Active users'),
        ].join('');

        strip.querySelectorAll('.metric[data-href]').forEach((el) => {
            const go = () => { window.location.href = el.getAttribute('data-href'); };
            el.addEventListener('click', go);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
        });
    }

    /* The pipeline bar. One line, every lead, in the same colours the leads
       table uses for its status pills - so it needs no legend to be read, only
       to be counted. */
    function renderPipeline(stats) {
        const counts = {};
        stats.byStatus.forEach((row) => { counts[row.status] = row.count; });

        const present = STATUS_ORDER.filter((s) => counts[s]);
        const total = present.reduce((sum, s) => sum + counts[s], 0);
        const bar = document.getElementById('pipeline-bar');
        const key = document.getElementById('pipeline-key');

        if (!total) {
            bar.innerHTML = '';
            key.innerHTML = '<span class="text-muted" style="font-size:13px;">No leads yet. ' +
                'They will appear here as the contact form and imports fill the pipeline.</span>';
            return;
        }

        bar.innerHTML = present.map((status) => {
            const share = (counts[status] / total) * 100;
            return '<button class="pipeline-seg" data-status="' + esc(status) + '"' +
                ' style="width:' + share.toFixed(2) + '%; background:' + STATUS_COLOUR[status] + ';"' +
                ' title="' + esc(window.fmt.label(status)) + ': ' + counts[status] + '"' +
                ' aria-label="' + esc(window.fmt.label(status)) + ': ' + counts[status] + ' leads">' +
                '</button>';
        }).join('');

        key.innerHTML = present.map((status) =>
            '<span class="pipeline-key-item">' +
            '<span class="pipeline-key-dot" style="background:' + STATUS_COLOUR[status] + '"></span>' +
            esc(window.fmt.label(status)) +
            ' <span class="pipeline-key-count">' + counts[status] + '</span>' +
            '</span>'
        ).join('');

        bar.querySelectorAll('.pipeline-seg').forEach((seg) => {
            seg.addEventListener('click', () => {
                // The CRM reads this on load and applies it as its status filter.
                window.location.href = 'crm.html?status=' + encodeURIComponent(seg.getAttribute('data-status'));
            });
        });
    }

    function renderRanks(rows) {
        const host = document.getElementById('source-ranks');
        if (!rows.length) {
            host.innerHTML = '<div class="crm-empty">No sources yet. They appear once leads start arriving.</div>';
            return;
        }
        const max = rows[0].count || 1;
        host.innerHTML = rows.map((row) =>
            '<div class="rank-row">' +
            '<div>' +
            '<div class="rank-label">' + esc(window.fmt.label(row.source)) + '</div>' +
            '<div class="rank-track"><div class="rank-fill" style="width:' +
            ((row.count / max) * 100).toFixed(1) + '%"></div></div>' +
            '</div>' +
            '<div class="rank-count">' + row.count + '</div>' +
            '</div>'
        ).join('');
    }

    // --- Inline SVG charts -------------------------------------------------
    // Small enough to draw by hand, and a charting library would be the first
    // CDN dependency in a project that has no build step.

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const PLOT = { left: 34, right: 8, top: 12, bottom: 22, w: 720, h: 180 };

    function svgEl(name, attrs) {
        const el = document.createElementNS(SVG_NS, name);
        Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    function chartFrame(svg, data) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        if (!data || !data.length) {
            svg.appendChild(Object.assign(
                svgEl('text', { x: PLOT.w / 2, y: PLOT.h / 2, 'text-anchor': 'middle', class: 'chart-empty' }),
                { textContent: 'No data for this range' }
            ));
            return null;
        }

        const max = Math.max(1, ...data.map((d) => d.count));
        const innerW = PLOT.w - PLOT.left - PLOT.right;
        const innerH = PLOT.h - PLOT.top - PLOT.bottom;

        // Three gridlines: floor, middle, ceiling. More would be furniture.
        [0, 0.5, 1].forEach((frac) => {
            const y = PLOT.top + innerH * (1 - frac);
            svg.appendChild(svgEl('line', {
                x1: PLOT.left, x2: PLOT.w - PLOT.right, y1: y, y2: y, class: 'chart-gridline',
            }));
            const label = svgEl('text', {
                x: PLOT.left - 8, y: y + 3, 'text-anchor': 'end', class: 'chart-axis-label',
            });
            label.textContent = Math.round(max * frac);
            svg.appendChild(label);
        });

        // Date labels at the ends only - a 365-day range cannot carry more.
        [[data[0], PLOT.left, 'start'], [data[data.length - 1], PLOT.w - PLOT.right, 'end']]
            .forEach(([point, x, anchor]) => {
                const label = svgEl('text', {
                    x, y: PLOT.h - 5, 'text-anchor': anchor, class: 'chart-axis-label',
                });
                label.textContent = new Date(point.date).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric',
                });
                svg.appendChild(label);
            });

        return { max, innerW, innerH };
    }

    function renderBars(svg, data) {
        const frame = chartFrame(svg, data);
        if (!frame) return;

        const today = new Date().toISOString().slice(0, 10);
        const slot = frame.innerW / data.length;
        const barW = Math.max(1, Math.min(slot - 2, 26));

        data.forEach((point, i) => {
            const height = (point.count / frame.max) * frame.innerH;
            const bar = svgEl('rect', {
                x: PLOT.left + i * slot + (slot - barW) / 2,
                y: PLOT.top + frame.innerH - height,
                width: barW,
                // A zero day still gets a visible floor, so the axis reads as a
                // row of days rather than a gap.
                height: Math.max(height, point.count ? 1 : 0.5),
                rx: Math.min(2, barW / 2),
                class: 'chart-bar' + (point.date === today ? ' is-today' : ''),
            });
            bar.appendChild(Object.assign(svgEl('title'), {
                textContent: point.count + ' on ' + point.date,
            }));
            svg.appendChild(bar);
        });
    }

    function renderArea(svg, data) {
        const frame = chartFrame(svg, data);
        if (!frame) return;

        const step = data.length > 1 ? frame.innerW / (data.length - 1) : 0;
        const points = data.map((point, i) => [
            PLOT.left + i * step,
            PLOT.top + frame.innerH - (point.count / frame.max) * frame.innerH,
        ]);

        const line = points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        const floor = PLOT.top + frame.innerH;

        svg.appendChild(svgEl('path', {
            d: line + ' L' + points[points.length - 1][0].toFixed(1) + ' ' + floor +
                ' L' + points[0][0].toFixed(1) + ' ' + floor + ' Z',
            class: 'chart-area',
        }));
        svg.appendChild(svgEl('path', { d: line, class: 'chart-line' }));
    }

    /* ======================================================================
     * Users
     * ==================================================================== */

    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const userModalError = document.getElementById('user-modal-error');

    async function loadUsers() {
        const tbodyEl = document.getElementById('user-tbody');
        if (!tbodyEl.dataset.loaded) tbodyEl.innerHTML = skeleton.table(3, 7);

        const rows = await api.get('/api/admin/users');
        tbodyEl.dataset.loaded = '1';
        usersCache = rows;
        const tbody = document.getElementById('user-tbody');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="crm-empty">Only you so far. Add a user to give someone access.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map((user) => {
            const isMe = user.id === me.id;
            return '<tr class="' + (user.isActive ? '' : 'user-inactive') + '">' +
                '<td>' + esc(user.name || '—') +
                    (isMe ? '<span class="you-marker">you</span>' : '') +
                    (user.isActive ? '' : '<span class="you-marker">deactivated</span>') + '</td>' +
                '<td>' + esc(user.email) + '</td>' +
                '<td><span class="role-chip ' + esc(user.role) + '">' + esc(user.role) + '</span></td>' +
                '<td class="tabular">' + user._count.leads + '</td>' +
                '<td class="tabular">' + user._count.tasks + '</td>' +
                '<td class="text-xs text-muted">' +
                    (user.lastLogin ? esc(window.fmt.timeAgo(user.lastLogin)) : 'never') + '</td>' +
                '<td>' +
                    '<button class="crm-btn-mini" data-edit-user="' + user.id + '">Edit</button> ' +
                    '<button class="crm-btn-mini" data-reset-user="' + user.id + '">Reset password</button> ' +
                    (isMe ? '' :
                        '<button class="crm-btn-mini ' + (user.isActive ? 'danger-btn' : '') + '"' +
                        ' data-toggle-user="' + user.id + '">' +
                        (user.isActive ? 'Deactivate' : 'Reactivate') + '</button>') +
                '</td>' +
            '</tr>';
        }).join('');
    }

    function openUserModal(user) {
        userModalError.style.display = 'none';
        document.getElementById('user-modal-title').textContent = user ? 'Edit user' : 'Add user';
        document.getElementById('user-submit-btn').textContent = user ? 'Save changes' : 'Create user';
        document.getElementById('user-id').value = user ? user.id : '';
        document.getElementById('user-name').value = user ? (user.name || '') : '';
        document.getElementById('user-email').value = user ? user.email : '';
        document.getElementById('user-role').value = user ? user.role : 'user';
        document.getElementById('user-password').value = '';

        // Email and password are set once, at creation. Changing an address
        // would orphan the person's sign-in; resetting a password has its own
        // button and its own audit entry.
        document.getElementById('user-email').disabled = Boolean(user);
        document.getElementById('password-field').style.display = user ? 'none' : '';

        userModal.style.display = 'flex';
        document.getElementById(user ? 'user-name' : 'user-email').focus();
    }

    function closeUserModal() {
        userModal.style.display = 'none';
        userForm.reset();
    }

    document.getElementById('add-user-btn').addEventListener('click', () => openUserModal(null));
    document.getElementById('close-user-modal').addEventListener('click', closeUserModal);
    document.getElementById('cancel-user-btn').addEventListener('click', closeUserModal);
    userModal.addEventListener('click', (e) => { if (e.target === userModal) closeUserModal(); });

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        userModalError.style.display = 'none';

        const id = document.getElementById('user-id').value;
        const payload = {
            name: document.getElementById('user-name').value.trim(),
            role: document.getElementById('user-role').value,
        };

        try {
            if (id) {
                await api.patch('/api/admin/users/' + id, payload);
                flash('Saved.');
            } else {
                payload.email = document.getElementById('user-email').value.trim();
                payload.password = document.getElementById('user-password').value;
                await api.post('/api/admin/users', payload);
                flash('User created. Send them the password.');
            }
            closeUserModal();
            await loadUsers();
        } catch (err) {
            userModalError.textContent = err.message;
            userModalError.style.display = 'block';
        }
    });

    document.getElementById('user-tbody').addEventListener('click', async (e) => {
        const edit = e.target.closest('[data-edit-user]');
        const reset = e.target.closest('[data-reset-user]');
        const toggle = e.target.closest('[data-toggle-user]');

        try {
            if (edit) {
                const user = usersCache.find((u) => u.id === Number(edit.getAttribute('data-edit-user')));
                if (user) openUserModal(user);
                return;
            }

            if (reset) {
                const user = usersCache.find((u) => u.id === Number(reset.getAttribute('data-reset-user')));
                if (!user) return;

                const password = await ask({
                    title: 'Set a new password',
                    body: 'For <strong>' + esc(user.name || user.email) + '</strong>. '
                        + 'They stay signed in on any device they are already using — '
                        + 'this changes what they need the next time they sign in.',
                    confirmLabel: 'Set password',
                    field: {
                        label: 'New password',
                        help: 'At least 8 characters. Send it to them yourself.',
                        placeholder: 'At least 8 characters',
                        suggest: true,
                        // Mirrors MIN_PASSWORD in server/lib/users.js. The server
                        // is still the authority; this only saves a round trip.
                        validate: (v) => (v.length === 0 ? 'Enter a password.'
                            : v.length < 8 ? 'Too short — 8 characters minimum.' : null),
                    },
                });

                if (password === null) return;
                await api.post('/api/admin/users/' + user.id + '/password', { password });
                flash('Password changed. Send it to them directly.');
                return;
            }

            if (toggle) {
                const user = usersCache.find((u) => u.id === Number(toggle.getAttribute('data-toggle-user')));
                if (!user) return;

                if (user.isActive) {
                    const go = await ask({
                        title: 'Deactivate this account?',
                        body: '<strong>' + esc(user.name || user.email) + '</strong> will be signed out '
                            + 'on their next request and cannot sign back in. Their '
                            + user._count.leads + ' leads and ' + user._count.tasks + ' tasks stay '
                            + 'exactly where they are, and you can reactivate them at any time.',
                        confirmLabel: 'Deactivate',
                        destructive: true,
                    });
                    if (!go) return;
                }

                await api.patch('/api/admin/users/' + user.id, { isActive: !user.isActive });
                flash(user.isActive ? 'Deactivated.' : 'Reactivated.');
                await loadUsers();
            }
        } catch (err) {
            fail(err);
        }
    });

    /* ======================================================================
     * Site content
     * ==================================================================== */

    let currentPage = null;

    async function loadContentPages() {
        const pages = await api.get('/api/admin/content/pages');
        const list = document.getElementById('page-list');

        list.innerHTML = pages.map((p) =>
            '<button class="page-item" data-page="' + esc(p.page) + '">' +
            '<span>' + esc(p.page) + '</span>' +
            (p.overrides ? '<span class="page-item-count">' + p.overrides + '</span>' : '') +
            '</button>'
        ).join('');

        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.page-item');
            if (!btn) return;
            list.querySelectorAll('.page-item').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            openPage(btn.getAttribute('data-page')).catch(fail);
        });
    }

    async function openPage(page) {
        currentPage = page;
        document.getElementById('content-page-title').textContent = page;

        const link = document.getElementById('preview-link');
        link.href = '/' + page;
        link.style.display = '';

        const host = document.getElementById('content-fields');
        host.innerHTML = skeleton.rows(5, 'skeleton-row');

        const data = await api.get('/api/admin/content/fields?page=' + encodeURIComponent(page));

        if (!data.fields.length) {
            host.innerHTML = '<div class="crm-empty">' +
                'Nothing on this page is marked as editable yet. Editable regions are marked in ' +
                'the HTML with a data-cms attribute.</div>';
            return;
        }

        host.innerHTML = data.fields.map((field) => {
            const value = field.value === null ? '' : field.value;
            const input = field.multiline
                ? '<textarea class="crm-textarea" rows="3" data-key="' + esc(field.key) + '"' +
                  ' placeholder="' + esc(field.original) + '">' + esc(value) + '</textarea>'
                : '<input class="crm-input" type="text" data-key="' + esc(field.key) + '"' +
                  ' placeholder="' + esc(field.original) + '" value="' + esc(value) + '">';

            return '<div class="field" data-field="' + esc(field.key) + '">' +
                '<div class="field-head">' +
                    '<span class="field-key">' + esc(field.key) + '</span>' +
                    '<span class="field-where">&lt;' + esc(field.tag) + '&gt;' +
                        (field.attr ? ' ' + esc(field.attr) : '') + '</span>' +
                '</div>' +
                input +
                '<div class="field-actions">' +
                    '<button class="crm-btn-mini primary" data-save="' + esc(field.key) + '">Save</button>' +
                    (field.value !== null
                        ? '<button class="crm-btn-mini" data-revert="' + esc(field.key) + '">Revert to original</button>'
                        : '') +
                    '<span class="field-state">Unsaved</span>' +
                    (field.updatedBy
                        ? '<span class="field-where">edited by ' + esc(field.updatedBy) + ' ' +
                          esc(window.fmt.timeAgo(field.updatedAt)) + '</span>'
                        : '') +
                '</div>' +
            '</div>';
        }).join('');
    }

    document.getElementById('content-fields').addEventListener('input', (e) => {
        const field = e.target.closest('.field');
        if (field) field.classList.add('is-dirty');
    });

    document.getElementById('content-fields').addEventListener('click', async (e) => {
        const save = e.target.closest('[data-save]');
        const revert = e.target.closest('[data-revert]');
        if (!save && !revert) return;

        const key = (save || revert).getAttribute(save ? 'data-save' : 'data-revert');

        try {
            if (save) {
                const input = document.querySelector('#content-fields [data-key="' + CSS.escape(key) + '"]');
                await api.put('/api/admin/content', { page: currentPage, key, value: input.value });
                flash('Saved. The page is live with the new text.');
            } else {
                await api.del('/api/admin/content', { page: currentPage, key });
                flash('Reverted to the original text.');
            }
            await openPage(currentPage);
            await refreshPageCounts();
        } catch (err) {
            fail(err);
        }
    });

    async function refreshPageCounts() {
        const pages = await api.get('/api/admin/content/pages');
        pages.forEach((p) => {
            const btn = document.querySelector('.page-item[data-page="' + CSS.escape(p.page) + '"]');
            if (!btn) return;
            const badge = btn.querySelector('.page-item-count');
            if (p.overrides && badge) badge.textContent = p.overrides;
            else if (p.overrides) {
                btn.insertAdjacentHTML('beforeend', '<span class="page-item-count">' + p.overrides + '</span>');
            } else if (badge) badge.remove();
        });
    }

    /* ======================================================================
     * Activity
     * ==================================================================== */

    let auditCursor = null;

    function verbClass(action) {
        if (/create|import|restore|comment/.test(action)) return 'verb-create';
        if (/delete|purge|blocked|failed/.test(action)) return 'verb-delete';
        if (/^auth\./.test(action)) return 'verb-auth';
        return 'verb-update';
    }

    function auditQuery() {
        const params = new URLSearchParams();
        const action = document.getElementById('audit-action').value;
        const actor = document.getElementById('audit-actor').value;
        const from = document.getElementById('audit-from').value;
        const to = document.getElementById('audit-to').value;

        if (action) params.set('action', action);
        if (actor) params.set('actorId', actor);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (auditCursor) params.set('cursor', auditCursor);

        return params.toString();
    }

    function diffTable(before, after) {
        const keys = Array.from(new Set([
            ...Object.keys(before || {}),
            ...Object.keys(after || {}),
        ]));
        if (!keys.length) return '';

        const cell = (value) => {
            if (value === null || value === undefined || value === '') return '—';
            return esc(typeof value === 'object' ? JSON.stringify(value) : String(value));
        };

        return '<div class="entry-diff">' +
            '<div class="diff-row diff-head"><div>Field</div><div>Was</div><div>Now</div></div>' +
            keys.map((key) =>
                '<div class="diff-row">' +
                '<div class="diff-field">' + esc(key) + '</div>' +
                '<div class="diff-before">' + cell(before && before[key]) + '</div>' +
                '<div class="diff-after">' + cell(after && after[key]) + '</div>' +
                '</div>'
            ).join('') +
            '</div>';
    }

    function entryHtml(row) {
        const who = row.actor ? (row.actor.name || row.actor.email) : 'system';
        const hasDetail = (row.before && Object.keys(row.before).length)
            || (row.after && Object.keys(row.after).length);

        return '<div class="entry ' + verbClass(row.action) + '">' +
            '<div class="entry-head">' +
                '<span class="entry-summary">' + esc(row.summary || row.action) + '</span>' +
                '<span class="entry-action">' + esc(row.action) + '</span>' +
            '</div>' +
            '<div class="entry-meta">' + esc(who) + ' · ' +
                esc(window.fmt.dateTime(row.createdAt)) +
                (row.ip ? ' · ' + esc(row.ip) : '') + '</div>' +
            (hasDetail
                ? '<button class="entry-toggle" data-entry="' + row.id + '">Show what changed</button>' +
                  '<div id="entry-detail-' + row.id + '" hidden>' + diffTable(row.before, row.after) + '</div>'
                : '') +
        '</div>';
    }

    async function loadAudit(append) {
        const timeline = document.getElementById('audit-timeline');
        if (!append) {
            auditCursor = null;
            timeline.innerHTML = skeleton.rows(6, 'skeleton-row');
        }

        const data = await api.get('/api/admin/audit?' + auditQuery());

        if (!append && !data.items.length) {
            timeline.innerHTML = '<div class="crm-empty">No activity matches these filters. Clear them to see everything.</div>';
            document.getElementById('audit-more').style.display = 'none';
            return;
        }

        const html = data.items.map(entryHtml).join('');
        if (append) timeline.insertAdjacentHTML('beforeend', html);
        else timeline.innerHTML = html;

        auditCursor = data.nextCursor;
        document.getElementById('audit-more').style.display = data.nextCursor ? '' : 'none';

        if (!append) await fillAuditFilters();
    }

    let auditFiltersReady = false;
    async function fillAuditFilters() {
        if (auditFiltersReady) return;
        auditFiltersReady = true;

        const [actions, people] = await Promise.all([
            api.get('/api/admin/audit/actions'),
            api.get('/api/admin/users'),
        ]);

        document.getElementById('audit-action').insertAdjacentHTML('beforeend',
            actions.map((a) =>
                '<option value="' + esc(a.action) + '">' + esc(a.action) + ' (' + a.count + ')</option>'
            ).join(''));

        document.getElementById('audit-actor').insertAdjacentHTML('beforeend',
            people.map((p) =>
                '<option value="' + p.id + '">' + esc(p.name || p.email) + '</option>'
            ).join(''));
    }

    ['audit-action', 'audit-actor', 'audit-from', 'audit-to'].forEach((id) => {
        document.getElementById(id).addEventListener('change', () => loadAudit(false).catch(fail));
    });

    document.getElementById('audit-clear').addEventListener('click', () => {
        ['audit-action', 'audit-actor', 'audit-from', 'audit-to'].forEach((id) => {
            document.getElementById(id).value = '';
        });
        loadAudit(false).catch(fail);
    });

    document.getElementById('audit-more').addEventListener('click', () => loadAudit(true).catch(fail));

    document.getElementById('audit-timeline').addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-entry]');
        if (!toggle) return;
        const detail = document.getElementById('entry-detail-' + toggle.getAttribute('data-entry'));
        const showing = !detail.hidden;
        detail.hidden = showing;
        toggle.textContent = showing ? 'Show what changed' : 'Hide';
    });

    /* ======================================================================
     * Data
     * ==================================================================== */

    async function loadData() {
        await loadTrash();
    }

    async function loadTrash() {
        const data = await api.get('/api/admin/data/trash');
        const host = document.getElementById('trash-list');
        const rows = [
            ...data.leads.map((l) => ({ type: 'lead', id: l.id, label: l.fullName || l.email || ('Lead #' + l.id), at: l.deletedAt })),
            ...data.tasks.map((t) => ({ type: 'task', id: t.id, label: t.title, at: t.deletedAt })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at));

        if (!rows.length) {
            host.innerHTML = '<div class="crm-empty">Nothing deleted. Leads and tasks you remove land here first.</div>';
            return;
        }

        host.innerHTML = '<div class="table-container"><table class="crm-table"><thead><tr>' +
            '<th>What</th><th>Type</th><th>Deleted</th><th>Actions</th>' +
            '</tr></thead><tbody>' +
            rows.map((row) =>
                '<tr>' +
                '<td>' + esc(row.label) + '</td>' +
                '<td class="text-muted">' + row.type + '</td>' +
                '<td class="text-xs text-muted">' + esc(window.fmt.timeAgo(row.at)) + '</td>' +
                '<td>' +
                    '<button class="crm-btn-mini primary" data-restore="' + row.type + ':' + row.id + '">Restore</button> ' +
                    '<button class="crm-btn-mini danger-btn" data-purge="' + row.type + ':' + row.id + '">Delete forever</button>' +
                '</td>' +
                '</tr>'
            ).join('') +
            '</tbody></table></div>';
    }

    document.getElementById('trash-list').addEventListener('click', async (e) => {
        const restore = e.target.closest('[data-restore]');
        const purge = e.target.closest('[data-purge]');
        if (!restore && !purge) return;

        const [type, id] = (restore || purge).getAttribute(restore ? 'data-restore' : 'data-purge').split(':');

        try {
            if (restore) {
                await api.post('/api/admin/data/trash/' + type + '/' + id + '/restore');
                flash('Restored.');
            } else {
                const row = purge.closest('tr');
                const label = row ? row.querySelector('td').textContent.trim() : (type + ' #' + id);

                const go = await ask({
                    title: 'Delete permanently?',
                    body: '<strong>' + esc(label) + '</strong> and everything attached to it — '
                        + 'notes, activity, comments — will be erased from the database. '
                        + 'This is the one action here that cannot be undone.',
                    confirmLabel: 'Delete forever',
                    destructive: true,
                    field: {
                        label: 'Type the name to confirm',
                        help: 'A deliberate step, because there is no way back from this one.',
                        placeholder: label,
                        validate: (v) => (v.trim() === label ? null : 'Does not match yet.'),
                    },
                });

                if (go === null) return;
                await api.del('/api/admin/data/trash/' + type + '/' + id);
                flash('Deleted permanently.');
            }
            await loadTrash();
        } catch (err) {
            fail(err);
        }
    });

    document.querySelectorAll('[data-export]').forEach((btn) => {
        btn.addEventListener('click', () => {
            // A plain navigation, so the browser handles the download and the
            // session cookie rides along.
            window.location.href = '/api/admin/data/export/' + btn.getAttribute('data-export') + '.csv';
        });
    });

    const csvInput = document.getElementById('admin-csv-input');
    document.getElementById('admin-import-btn').addEventListener('click', () => csvInput.click());

    csvInput.addEventListener('change', async () => {
        const file = csvInput.files[0];
        if (!file) return;

        const result = document.getElementById('admin-import-result');
        result.innerHTML = '<span class="text-muted">Reading ' + esc(file.name) + '…</span>';

        const form = new FormData();
        form.append('csvFile', file);

        try {
            const data = await api.upload('/api/import-csv', form);
            result.innerHTML =
                '<div style="color:var(--status-won-color); font-weight:600;">' +
                    data.successCount + ' imported</div>' +
                '<div class="text-muted" style="margin-top:4px;">' +
                    data.totalParsed + ' rows read, ' + data.errorCount + ' skipped.</div>' +
                (data.errors && data.errors.length
                    ? '<ul class="text-xs text-muted" style="margin:8px 0 0 16px;">' +
                      data.errors.map((e2) => '<li>Row ' + e2.line + ': ' + esc(e2.reason) + '</li>').join('') +
                      '</ul>'
                    : '');
            flash(data.successCount + ' leads imported.');
        } catch (err) {
            result.innerHTML = '<span style="color:#fca5a5;">' + esc(err.message) + '</span>';
        } finally {
            csvInput.value = '';
        }
    });

    /* ======================================================================
     * Settings
     * ==================================================================== */

    let settingsValues = null;

    async function loadSettings() {
        const data = await api.get('/api/admin/settings');
        settingsValues = data.values;

        document.getElementById('gate-enabled').checked = Boolean(settingsValues['gate.enabled']);
        document.getElementById('gate-password').value = settingsValues['gate.password'] || '';
        document.getElementById('notify-emails').value = (settingsValues['notify.emails'] || []).join('\n');

        renderInterestMap(settingsValues['leads.interestMap'] || {});
        renderStatusLabels(settingsValues['leads.statuses'] || []);
    }

    function interestRow(formValue, category) {
        return '<div class="pair-row">' +
            '<input class="crm-input" data-interest-key placeholder="form value, e.g. digitalizacija" value="' +
                esc(formValue) + '">' +
            '<input class="crm-input" data-interest-value placeholder="CRM category" value="' +
                esc(category) + '">' +
            '<button class="crm-btn-mini danger-btn" data-remove-interest type="button">Remove</button>' +
            '</div>';
    }

    function renderInterestMap(map) {
        document.getElementById('interest-map').innerHTML =
            Object.entries(map).map(([k, v]) => interestRow(k, v)).join('');
    }

    document.getElementById('add-interest-row').addEventListener('click', () => {
        document.getElementById('interest-map').insertAdjacentHTML('beforeend', interestRow('', 'general'));
    });

    document.getElementById('interest-map').addEventListener('click', (e) => {
        const remove = e.target.closest('[data-remove-interest]');
        if (remove) remove.closest('.pair-row').remove();
    });

    function renderStatusLabels(statuses) {
        document.getElementById('status-labels').innerHTML = statuses.map((s) =>
            '<div class="pair-row">' +
            '<div class="rank-label" style="font-size:12px;">' +
                '<span class="' + window.fmt.statusClass(s.id) + '">' + esc(window.fmt.label(s.id)) + '</span>' +
            '</div>' +
            '<input class="crm-input" data-status-id="' + esc(s.id) + '" value="' + esc(s.label) + '">' +
            '<span class="pair-arrow"></span>' +
            '</div>'
        ).join('');
    }

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const interestMap = {};
        document.querySelectorAll('#interest-map .pair-row').forEach((row) => {
            const key = row.querySelector('[data-interest-key]').value.trim();
            const value = row.querySelector('[data-interest-value]').value.trim();
            if (key) interestMap[key] = value;
        });

        const statuses = Array.from(document.querySelectorAll('#status-labels [data-status-id]')).map((input) => ({
            id: input.getAttribute('data-status-id'),
            label: input.value.trim() || input.getAttribute('data-status-id'),
        }));

        const emails = document.getElementById('notify-emails').value
            .split('\n').map((line) => line.trim()).filter(Boolean);

        try {
            const saved = await api.put('/api/admin/settings', {
                values: {
                    'gate.enabled': document.getElementById('gate-enabled').checked,
                    'gate.password': document.getElementById('gate-password').value,
                    'leads.interestMap': interestMap,
                    'leads.statuses': statuses,
                    'notify.emails': emails,
                },
            });
            settingsValues = saved.values;
            flash('Settings saved.');
        } catch (err) {
            fail(err);
        }
    });
});
