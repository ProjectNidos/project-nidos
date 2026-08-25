document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '';
    let currentLeads = [];
    let currentTasks = [];
    let currentDragInfo = null;
    let activeTaskId = null;
    let leadCursor = null;
    let leadTotal = 0;
    let colleagues = [];

    /* The session is an httpOnly cookie the page cannot read, so there is
       nothing to check here - api.js sends the cookie with every request and
       redirects to the login page on a 401. The name below is only for the
       sidebar; api.get('/api/auth/me') is what actually confirms the session. */
    const api = window.api;
    const esc = window.fmt.esc;

    /* The dialog and the toast are shared with the admin panel - see ui.js.
       Every alert() and confirm() in this file went through them: an alert
       blocks the page and looks like a browser error rather than the product
       speaking, and a confirm cannot name the record it is about. */
    const flash = window.ui.flash;
    const ask = window.ui.ask;

    (async function whoami() {
        try {
            const user = await api.get('/api/auth/me');
            try { localStorage.setItem('crm_user', JSON.stringify(user)); } catch (e) { /* private mode */ }

            const userDisplay = document.getElementById('user-display');
            if (userDisplay) userDisplay.textContent = user.name || user.email;

            // The admin panel and the bulk bar are only worth offering to
            // someone the server will actually let use them.
            if (user.role === 'admin') {
                const adminLink = document.getElementById('admin-link');
                if (adminLink) adminLink.hidden = false;

                const bulkBar = document.getElementById('bulk-bar');
                if (bulkBar) bulkBar.hidden = false;
            }
        } catch (err) {
            /* api.js has already redirected an expired session. */
        }
    }());

    // --- DOM Elements ---
    const logoutBtn = document.getElementById('logout-btn');

    // Views
    const navItems = document.querySelectorAll('.crm-nav-item[data-view]');
    const views = document.querySelectorAll('.crm-view');

    // Leads Elements
    const leadTbody = document.getElementById('lead-tbody');
    const leadCountBadge = document.getElementById('lead-count-badge');
    const filterStatus = document.getElementById('filter-status');
    const filterQ = document.getElementById('filter-q');

    // Tasks/Kanban Elements
    const addTaskBtn = document.getElementById('add-task-btn');
    const createTaskModal = document.getElementById('create-task-modal');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const taskForm = document.getElementById('task-form');

    const colTodo = document.getElementById('col-todo');
    const colInProgress = document.getElementById('col-inprogress');
    const colDone = document.getElementById('col-done');
    const kanbanColumns = [colTodo, colInProgress, colDone];

    const countTodo = document.getElementById('count-todo');
    const countInProgress = document.getElementById('count-inprogress');
    const countDone = document.getElementById('count-done');

    // Modal Elements
    const taskModal = document.getElementById('task-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTaskTitle = document.getElementById('modal-task-title');
    const modalTaskDesc = document.getElementById('modal-task-desc');
    const modalTaskStatus = document.getElementById('modal-task-status');
    const modalTaskDue = document.getElementById('modal-task-due');
    const modalTaskAssignee = document.getElementById('modal-task-assignee');
    const modalCommentsList = document.getElementById('modal-comments-list');
    const modalCommentForm = document.getElementById('modal-comment-form');
    const modalCommentInput = document.getElementById('modal-comment-input');

    // --- Task Creation Modal Logic ---
    function openCreateTaskModal(dateStr = '', lead = null) {
        createTaskModal.style.display = 'flex';
        document.getElementById('task-due').value = dateStr || '';

        // Prefilled from an incoming request so the follow-up keeps its context
        if (lead) {
            document.getElementById('task-title').value = `Follow up: ${lead.fullName || 'website request'}`;
            document.getElementById('task-lead-id').value = lead.id;
            document.getElementById('task-desc').value = lead.notes || '';
        }

        document.getElementById('task-title').focus();
    }

    function closeCreateTaskModal() {
        createTaskModal.style.display = 'none';
        taskForm.reset();
    }

    if (addTaskBtn) addTaskBtn.addEventListener('click', () => openCreateTaskModal());
    if (closeCreateModalBtn) closeCreateModalBtn.addEventListener('click', closeCreateTaskModal);
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeCreateTaskModal);
    if (createTaskModal) {
        createTaskModal.addEventListener('click', (e) => {
            if (e.target === createTaskModal) closeCreateTaskModal();
        });
    }

    // --- Navigation Logic ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const viewId = `view-${item.getAttribute('data-view')}`;
            views.forEach(v => {
                if (v.id === viewId) v.classList.add('active');
                else v.classList.remove('active');
            });
        });
    });

    logoutBtn.addEventListener('click', () => api.logout());

    // --- Leads Logic ---
    // Shared with the admin panel. The copy that used to live here returned
    // "status-proposal_sent" for a proposal, and crm.css only defines
    // .status-proposal - so that one pill rendered unstyled.
    const statusClass = window.fmt.statusClass;

    /* The list is paginated now - it used to return every lead in the table on
       every keystroke of the search box. `append` continues from the last
       cursor instead of starting over. */
    async function fetchLeads(append) {
        const params = new URLSearchParams();
        if (filterStatus.value) params.append('status', filterStatus.value);
        if (filterQ.value.trim()) params.append('q', filterQ.value.trim());
        if (append && leadCursor) params.append('cursor', leadCursor);

        const url = `${API_BASE}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;

        try {
            const data = await api.get(url);

            leadCursor = data.nextCursor;
            leadTotal = data.total;
            currentLeads = append ? currentLeads.concat(data.items) : data.items;

            renderLeads(currentLeads);
        } catch (err) {
            console.error('Failed to fetch leads', err);
            leadTbody.innerHTML = `<tr><td colspan="7" class="crm-empty" style="color:var(--status-lost-color)">Could not load leads: ${esc(err.message)}</td></tr>`;
            requestsList.innerHTML = `<div class="crm-empty" style="color:var(--status-lost-color)">Could not load requests: ${esc(err.message)}</div>`;
        }
    }

    async function updateLeadStatus(leadId, status) {
        try {
            await api.put(`${API_BASE}/api/leads/${leadId}`, { status });
            await Promise.all([fetchLeads(false), fetchRequests()]);
        } catch (err) {
            console.error(err);
            flash(err.message || 'Could not update the status.', 'error');
        }
    }

    function renderLeads(leads) {
        currentLeads = Array.isArray(leads) ? leads : [];

        document.getElementById('load-more-leads').style.display = leadCursor ? '' : 'none';

        if (!leads.length) {
            leadTbody.innerHTML = '<tr><td colspan="7" class="crm-empty">No leads match this filter.</td></tr>';
            if (leadCountBadge) leadCountBadge.textContent = '0 leads';
            syncBulkBar();
            return;
        }

        /* "24 of 310" once the list runs past a page. The badge used to report
           the page size as though it were the whole table. */
        if (leadCountBadge) {
            leadCountBadge.textContent = leads.length < leadTotal
                ? `${leads.length} of ${leadTotal} leads`
                : `${leadTotal} lead${leadTotal === 1 ? '' : 's'}`;
        }
        leadTbody.innerHTML = '';

        leads.forEach(lead => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', lead.id); // Valid ID for click handler
            tr.style.cursor = 'pointer'; // Show clickable pointer

            const created = new Date(lead.createdAt).toLocaleDateString();
            const status = lead.status || 'new';
            const statusOptions = [
                { value: 'new', label: 'New' },
                { value: 'contacted', label: 'Contacted' },
                { value: 'qualified', label: 'Qualified' },
                { value: 'proposal_sent', label: 'Proposal Sent' },
                { value: 'won', label: 'Won' },
                { value: 'lost', label: 'Lost' },
            ];

            tr.innerHTML = `
                <td><input type="checkbox" class="lead-check" data-check="${lead.id}"
                           aria-label="Select ${esc(lead.fullName || 'lead ' + lead.id)}"></td>
                <td>
                    <div class="font-medium" style="color:#fff;">${esc(lead.fullName || '(no name)')}</div>
                    <div class="text-xs text-muted">ID: ${lead.id}${lead.owner ? ' · ' + esc(lead.owner.name || lead.owner.email) : ''}</div>
                </td>
                <td>
                    <div style="font-size:13px;">${esc(lead.email || '')}</div>
                    <div class="text-xs text-muted">${esc(lead.phone || '')}</div>
                </td>
                <td><span class="crm-badge">${esc(window.fmt.label(lead.source || 'manual'))}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="${statusClass(status)}">${esc(window.fmt.label(status))}</span>
                        <select class="crm-select" data-lead-id="${lead.id}" style="width:auto; padding:2px 6px; font-size:11px; height:auto;">
                            ${statusOptions.map(opt => `<option value="${opt.value}" ${opt.value === status ? 'selected' : ''}>${opt.label}</option>`).join('')}
                        </select>
                    </div>
                </td>
                <td class="text-xs text-muted">${created}</td>
                <td>
                    <button class="crm-btn-primary" data-delete-lead="${lead.id}" style="background:rgba(255,255,255,0.1); border:none; width:28px; height:28px; padding:0; border-radius:6px; color:#fff;">✕</button>
                </td>
            `;
            leadTbody.appendChild(tr);
        });
    }

    leadTbody.addEventListener('change', (e) => {
        if (e.target.matches('select[data-lead-id]')) {
            updateLeadStatus(e.target.getAttribute('data-lead-id'), e.target.value);
        }
    });

    leadTbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-delete-lead]');
        if (btn) {
            const leadId = btn.getAttribute('data-delete-lead');
            const lead = findLead(leadId);

            const go = await ask({
                title: 'Move to the trash?',
                body: '<strong>' + esc(lead ? (lead.fullName || lead.email || 'Lead #' + leadId) : 'This lead')
                    + '</strong> leaves the list but is not destroyed — an admin can restore it '
                    + 'from the trash.',
                confirmLabel: 'Move to trash',
                destructive: true,
            });
            if (!go) return;

            try {
                await api.del(`${API_BASE}/api/leads/${leadId}`);
                fetchLeads();
            } catch (err) {
                console.error(err);
                flash(err.message || 'Could not delete the lead.', 'error');
            }
        }
    });

    // --- Lead Details Modal Logic ---
    const leadModal = document.getElementById('lead-modal');
    const closeLeadModalBtn = document.getElementById('close-lead-modal-btn');
    const modalLeadName = document.getElementById('modal-lead-name');
    const modalLeadStatus = document.getElementById('modal-lead-status');
    const modalLeadEmail = document.getElementById('modal-lead-email');
    const modalLeadPhone = document.getElementById('modal-lead-phone');
    const modalLeadNotes = document.getElementById('modal-lead-notes');
    const saveLeadBtn = document.getElementById('save-lead-btn');
    let currentLeadId = null;

    function openLeadModal(lead) {
        currentLeadId = lead.id;
        modalLeadName.textContent = lead.fullName || 'Unknown';
        modalLeadStatus.value = lead.status || 'new';
        modalLeadEmail.textContent = lead.email || '-';
        modalLeadPhone.textContent = lead.phone || '-';

        // Simple Markdown Parser
        const rawNotes = lead.notes || '(No notes/chat history)';
        modalLeadNotes.innerHTML = esc(rawNotes)
            .replace(/\*\*(.*?)\*\*/g, '<b style="color:var(--primary-color);">$1</b>')
            .replace(/\n/g, '<br>');

        leadModal.style.display = 'flex';
    }

    // Open Modal on Row Click
    leadTbody.addEventListener('click', (e) => {
        // Ignore clicks on actions/selects
        if (e.target.closest('button') || e.target.closest('select')) return;

        const tr = e.target.closest('tr');
        if (!tr) return;

        const lead = findLead(tr.getAttribute('data-id'));
        if (lead) openLeadModal(lead);
    });

    if (closeLeadModalBtn) {
        closeLeadModalBtn.addEventListener('click', () => {
            leadModal.style.display = 'none';
            currentLeadId = null;
        });
    }

    if (leadModal) {
        leadModal.addEventListener('click', (e) => {
            if (e.target === leadModal) leadModal.style.display = 'none';
        });
    }

    if (saveLeadBtn) {
        saveLeadBtn.addEventListener('click', async () => {
            if (!currentLeadId) return;
            const newStatus = modalLeadStatus.value;

            try {
                await api.put(`${API_BASE}/api/leads/${currentLeadId}`, { status: newStatus });
                leadModal.style.display = 'none';
                fetchLeads();
            } catch (err) {
                flash(err.message || 'Could not save the changes.', 'error');
            }
        });
    }

    // A new filter is a new list, so the cursor has to be dropped with it.
    function refilterLeads() {
        leadCursor = null;
        fetchLeads(false);
    }

    filterStatus.addEventListener('change', refilterLeads);
    filterQ.addEventListener('input', () => {
        clearTimeout(filterQ._debounceTimer);
        filterQ._debounceTimer = setTimeout(refilterLeads, 300);
    });

    document.getElementById('load-more-leads').addEventListener('click', () => fetchLeads(true));

    /* --- Deep links ---------------------------------------------------------
       The admin dashboard links straight into a filtered view: the pipeline
       segments carry ?status=, and the tiles carry #requests / #tasks. */
    (function applyDeepLink() {
        const status = new URLSearchParams(window.location.search).get('status');
        if (status) filterStatus.value = status;

        const hash = window.location.hash.replace('#', '');
        if (hash) {
            const navItem = document.querySelector(`.crm-nav-item[data-view="${CSS.escape(hash)}"]`);
            if (navItem) navItem.click();
        }
    }());

    /* --- Bulk actions -------------------------------------------------------
       Admin-only, because /api/admin/data/leads/bulk is. The bar stays hidden
       for everyone else rather than offering a button that 403s. */
    const bulkBar = document.getElementById('bulk-bar');
    const bulkAll = document.getElementById('bulk-all');

    function selectedLeadIds() {
        return Array.from(document.querySelectorAll('.lead-check:checked'))
            .map(box => Number(box.getAttribute('data-check')));
    }

    function syncBulkBar() {
        const count = selectedLeadIds().length;
        document.getElementById('bulk-count').textContent = `${count} selected`;
        bulkBar.style.opacity = count ? '1' : '0.5';
    }

    leadTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('lead-check')) syncBulkBar();
    });

    bulkAll.addEventListener('change', () => {
        document.querySelectorAll('.lead-check').forEach(box => { box.checked = bulkAll.checked; });
        syncBulkBar();
    });

    async function runBulk(action, value, confirmText) {
        const ids = selectedLeadIds();
        if (!ids.length) return flash('Select some leads first.', 'error');
        if (confirmText) {
            const go = await ask({
                title: 'Move ' + ids.length + ' leads to the trash?',
                body: 'They leave the list but are not destroyed — an admin can restore them '
                    + 'from the trash.',
                confirmLabel: 'Move ' + ids.length + ' to trash',
                destructive: true,
            });
            if (!go) return;
        }

        try {
            const result = await api.post('/api/admin/data/leads/bulk', { ids, action, value });
            bulkAll.checked = false;
            leadCursor = null;
            await fetchLeads(false);
            flash(`${result.count} lead${result.count === 1 ? '' : 's'} updated.`);
        } catch (err) {
            flash(err.message || 'The bulk change did not go through.', 'error');
        }
    }

    document.getElementById('bulk-status').addEventListener('change', (e) => {
        if (!e.target.value) return;
        const status = e.target.value;
        e.target.value = '';
        runBulk('status', status);
    });

    document.getElementById('bulk-owner').addEventListener('change', (e) => {
        if (!e.target.value) return;
        const ownerId = e.target.value;
        e.target.value = '';
        runBulk('owner', Number(ownerId));
    });

    document.getElementById('bulk-delete').addEventListener('click', () => {
        runBulk('delete', null, 'Move {n} leads to the trash? An admin can restore them.');
    });

    /* --- Colleagues ---------------------------------------------------------
       Until this list existed, Task.assignedToId could only ever be whoever
       created the task - the server filled it in from the session because the
       UI had nothing to offer. */
    async function loadColleagues() {
        try {
            colleagues = await api.get('/api/users');
        } catch (err) {
            colleagues = []; // dropdowns fall back to "Me" / "Unassigned"
            return;
        }

        const options = colleagues
            .map(u => `<option value="${u.id}">${esc(u.name || u.email)}</option>`)
            .join('');

        document.getElementById('task-assignee').insertAdjacentHTML('beforeend', options);
        document.getElementById('modal-task-assignee').insertAdjacentHTML('beforeend', options);
        document.getElementById('bulk-owner').insertAdjacentHTML('beforeend', options);
    }

    function renderAssigneePicker(task) {
        modalTaskAssignee.value = task.assignedToId ? String(task.assignedToId) : '';
    }

    modalTaskAssignee.addEventListener('change', async () => {
        if (!activeTaskId) return;
        try {
            await api.put(`${API_BASE}/api/tasks/${activeTaskId}`, {
                assignedToId: modalTaskAssignee.value ? Number(modalTaskAssignee.value) : null
            });
            fetchTasks();
        } catch (err) {
            flash(err.message || 'Could not change the assignee.', 'error');
        }
    });


    // --- Incoming Requests ---
    // Sources the public form webhook writes (server/routes/webhooks.js). Anything
    // else - manual entry, CSV import - is a lead but not an incoming request.
    const REQUEST_SOURCES = {
        website_form: 'Website form',
        emissions_compliance: 'Emissions compliance',
        nature_restoration: 'Nature restoration',
        digitalisation: 'Digitalisation',
        general: 'General enquiry'
    };

    const requestsList = document.getElementById('requests-list');
    const requestCountBadge = document.getElementById('request-count-badge');
    const navRequestsCount = document.getElementById('nav-requests-count');
    const showHandledToggle = document.getElementById('requests-show-handled');

    /* esc(), timeAgo() and statusClass() moved to api.js when the admin panel
       started needing the same three. esc() in particular is load-bearing:
       request bodies come straight from a public form and are rendered into
       innerHTML just below. */
    const timeAgo = window.fmt.timeAgo;

    function findLead(id) {
        return currentLeads.find(l => l.id == id)
            || currentRequests.find(l => l.id == id);
    }

    function requestCardHtml(lead) {
        const status = lead.status || 'new';
        const contact = [lead.email, lead.phone].filter(Boolean).map(esc).join(' &middot; ');
        const sourceLabel = REQUEST_SOURCES[lead.source] || lead.source;

        return `
            <article class="request-card ${status === 'new' ? 'is-new' : 'handled'}">
                <div class="request-head">
                    <div>
                        <div class="request-name">${esc(lead.fullName || '(no name)')}</div>
                        <div class="request-contact">${contact || 'No contact details'}</div>
                    </div>
                    <div class="request-head-right">
                        <span class="crm-badge">${esc(sourceLabel)}</span>
                        <span class="${statusClass(status)}">${esc(window.fmt.label(status))}</span>
                        <span class="text-xs text-muted">${timeAgo(lead.createdAt)}</span>
                    </div>
                </div>
                <div class="request-message">${lead.notes ? esc(lead.notes) : '<span class="text-muted">(no message)</span>'}</div>
                <div class="request-actions">
                    ${status === 'new' ? `<button class="crm-btn-mini primary" data-request-contacted="${lead.id}">Mark contacted</button>` : ''}
                    <button class="crm-btn-mini" data-request-task="${lead.id}">Create task</button>
                    <button class="crm-btn-mini" data-request-open="${lead.id}">Open lead</button>
                    ${lead.email ? `<a class="crm-btn-mini" href="mailto:${esc(lead.email)}">Reply by email</a>` : ''}
                </div>
            </article>`;
    }

    /* The inbox is fetched, not filtered out of the leads page. Deriving it from
       currentLeads worked only while that list was every lead in the table; now
       that it is paged, an enquiry older than the newest page would drop out of
       the inbox without anyone touching it. */
    let currentRequests = [];
    let unhandledCount = 0;

    async function fetchRequests() {
        try {
            const all = showHandledToggle.checked ? '?all=1' : '';
            const data = await api.get(`${API_BASE}/api/leads/requests${all}`);
            currentRequests = data.items;
            unhandledCount = data.unhandled;
            renderRequests();
        } catch (err) {
            console.error('Failed to fetch requests', err);
            requestsList.innerHTML = `<div class="crm-empty" style="color:var(--status-lost-color)">Could not load requests: ${esc(err.message)}</div>`;
        }
    }

    function renderRequests() {
        const requests = currentRequests;

        navRequestsCount.textContent = unhandledCount;
        navRequestsCount.hidden = unhandledCount === 0;
        requestCountBadge.textContent = `${unhandledCount} new`;

        const visible = requests;
        if (!visible.length) {
            requestsList.innerHTML = `<div class="crm-empty">${showHandledToggle.checked ? 'No website requests yet.' : 'No new requests - everything has been picked up.'}</div>`;
            return;
        }

        requestsList.innerHTML = visible.map(requestCardHtml).join('');
    }

    showHandledToggle.addEventListener('change', fetchRequests);

    requestsList.addEventListener('click', (e) => {
        const contactedBtn = e.target.closest('button[data-request-contacted]');
        if (contactedBtn) {
            updateLeadStatus(contactedBtn.getAttribute('data-request-contacted'), 'contacted');
            return;
        }

        const taskBtn = e.target.closest('button[data-request-task]');
        if (taskBtn) {
            const lead = findLead(taskBtn.getAttribute('data-request-task'));
            if (lead) openCreateTaskModal('', lead);
            return;
        }

        const openBtn = e.target.closest('button[data-request-open]');
        if (openBtn) {
            const lead = findLead(openBtn.getAttribute('data-request-open'));
            if (lead) openLeadModal(lead);
        }
    });

    // --- Tasks / Kanban Logic ---

    // Toggle Task Form - Removed old logic, now using openCreateTaskModal

    // 1. Fetch Tasks (Kanban & Calendar)
    async function fetchTasks() {
        try {
            // api.get() adds its own cache-buster - the board reads back its
            // own writes and a 304 would show the state before the drag.
            currentTasks = await api.get(`${API_BASE}/api/tasks`);
            renderKanban(currentTasks);
            // Ensure calendar renders if the function exists
            if (typeof renderCalendar === 'function') renderCalendar();
        } catch (err) {
            console.error('Failed to fetch tasks', err);
        }
    }

    function createKanbanCard(task) {
        const div = document.createElement('div');
        div.className = 'kanban-card';
        div.setAttribute('draggable', 'true');
        div.setAttribute('data-task-id', task.id);

        const dateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const commentCount = task.comments ? task.comments.length : 0;

        /* The meta line used to read "📅 12/03/2026  💬 3". The icons are the
           same line set as the nav, and a comment count of zero is not worth
           a row of its own. */
        div.innerHTML = `
            <div class="kanban-actions">
                <button class="card-remove stop-prop" data-delete-task="${task.id}"
                        title="Move to trash" aria-label="Move this task to the trash">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
                         stroke-linecap="round" aria-hidden="true">
                        <path d="M4 4l8 8"/><path d="M12 4l-8 8"/>
                    </svg>
                </button>
            </div>
            <div class="kanban-card-title">${esc(task.title)}</div>
            <div class="kanban-card-desc">${esc(task.description || 'No description')}</div>
            <div class="kanban-card-meta">
                <span class="card-date">${dateStr || 'No date'}</span>
                ${commentCount ? `<span class="card-comments">${commentCount} comment${commentCount === 1 ? '' : 's'}</span>` : ''}
            </div>
        `;

        // Click to Open Modal
        div.addEventListener('click', (e) => {
            if (e.target.closest('.stop-prop')) return; // Ignore delete button
            openTaskModal(task);
        });

        // Drag Start
        div.addEventListener('dragstart', (e) => {
            currentDragInfo = { id: task.id, originStatus: task.status };
            div.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            currentDragInfo = null;
        });

        return div;
    }

    function renderKanban(tasks) {
        colTodo.innerHTML = '';
        colInProgress.innerHTML = '';
        colDone.innerHTML = '';

        let cTodo = 0, cInProg = 0, cDone = 0;

        tasks.forEach(task => {
            const card = createKanbanCard(task);
            if (task.status === 'todo') { colTodo.appendChild(card); cTodo++; }
            else if (task.status === 'in_progress') { colInProgress.appendChild(card); cInProg++; }
            else if (task.status === 'done') { colDone.appendChild(card); cDone++; }
        });

        countTodo.textContent = cTodo;
        countInProgress.textContent = cInProg;
        countDone.textContent = cDone;
    }

    // Drag-and-Drop Columns logic...
    kanbanColumns.forEach(col => {
        // ... (existing drag logic)
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.closest('.kanban-column').classList.add('drag-over');
            e.dataTransfer.dropEffect = 'move';
        });

        col.addEventListener('dragleave', () => {
            col.closest('.kanban-column').classList.remove('drag-over');
        });

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.closest('.kanban-column').classList.remove('drag-over');

            if (!currentDragInfo) return;
            const newStatus = col.getAttribute('data-status');
            const taskId = currentDragInfo.id;

            if (newStatus !== currentDragInfo.originStatus) {
                // Optimistic UI
                const card = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
                if (card) {
                    col.appendChild(card);
                    updateKanbanCounts();
                }

                try {
                    await api.put(`${API_BASE}/api/tasks/${taskId}`, { status: newStatus });

                    // Update local state
                    const task = currentTasks.find(t => t.id == taskId);
                    if (task) task.status = newStatus;
                } catch (err) {
                    console.error(err);
                    flash(err.message || 'Could not move the task.', 'error');
                    fetchTasks(); // Revert
                }
            }
        });
    });

    function updateKanbanCounts() {
        countTodo.textContent = colTodo.children.length;
        countInProgress.textContent = colInProgress.children.length;
        countDone.textContent = colDone.children.length;
    }

    // Delete Task
    document.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('button[data-delete-task]');
        if (delBtn) {
            const taskId = delBtn.getAttribute('data-delete-task');
            const task = currentTasks.find(t => t.id == taskId);

            const go = await ask({
                title: 'Move to the trash?',
                body: '<strong>' + esc(task ? task.title : 'This task')
                    + '</strong> leaves the board but is not destroyed — an admin can restore it '
                    + 'from the trash.',
                confirmLabel: 'Move to trash',
                destructive: true,
            });
            if (!go) return;

            try {
                await api.del(`${API_BASE}/api/tasks/${taskId}`);
                const modal = document.getElementById('task-modal');
                if (modal && modal.style.display === 'flex') closeModal();
                fetchTasks();
            } catch (err) {
                console.error(err);
                flash(err.message || 'Could not delete the task.', 'error');
            }
        }
    });

    // Create Task
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title').value;
        const dueDateVal = document.getElementById('task-due').value;
        const leadIdVal = document.getElementById('task-lead-id').value;
        const description = document.getElementById('task-desc').value;
        const assigneeVal = document.getElementById('task-assignee').value;

        try {
            await api.post(`${API_BASE}/api/tasks`, {
                title,
                description,
                status: 'todo', // Explicit default status
                dueDate: dueDateVal ? new Date(dueDateVal).toISOString() : null,
                leadId: leadIdVal ? Number(leadIdVal) : null,
                assignedToId: assigneeVal ? Number(assigneeVal) : null
            });
            taskForm.reset();
            closeCreateTaskModal();
            // Force fetch to update UI
            await fetchTasks();
        } catch (err) {
            console.error(err);
            flash(err.message || 'Could not create the task.', 'error');
        }
    });

    // --- Modal Logic ---
    function openTaskModal(task) {
        activeTaskId = task.id;
        modalTaskTitle.textContent = task.title;
        modalTaskDesc.textContent = task.description || 'No description provided.';
        modalTaskStatus.value = task.status;
        modalTaskDue.textContent = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date';
        renderAssigneePicker(task);

        renderComments(task.comments || []);

        taskModal.style.display = 'flex';
    }

    function closeModal() {
        taskModal.style.display = 'none';
        activeTaskId = null;
    }

    closeModalBtn.addEventListener('click', closeModal);
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) closeModal();
    });

    // Change status from modal
    modalTaskStatus.addEventListener('change', async () => {
        if (!activeTaskId) return;
        try {
            await api.put(`${API_BASE}/api/tasks/${activeTaskId}`, { status: modalTaskStatus.value });
            fetchTasks(); // Refresh board
        } catch (err) {
            console.error(err);
            flash(err.message || 'Could not change the status.', 'error');
        }
    });

    // Render Comments
    function renderComments(comments) {
        modalCommentsList.innerHTML = '';
        if (!comments.length) {
            modalCommentsList.innerHTML = '<div class="text-muted text-xs">No comments yet.</div>';
            return;
        }

        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'task-comment';
            const authorName = c.author?.name || c.author?.email || 'Unknown';
            const time = new Date(c.createdAt).toLocaleString();

            div.innerHTML = `
                <div class="comment-meta">
                    <strong>${esc(authorName)}</strong>
                    <span>${esc(time)}</span>
                </div>
                <div>${esc(c.content)}</div>
            `;
            modalCommentsList.appendChild(div);
        });
    }

    // Post Comment
    modalCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = modalCommentInput.value.trim();
        if (!content || !activeTaskId) return;

        try {
            const newComment = await api.post(`${API_BASE}/api/tasks/${activeTaskId}/comments`, { content });

            // Add to UI immediately
            const currentTask = currentTasks.find(t => t.id === activeTaskId);
            if (currentTask) {
                if (!currentTask.comments) currentTask.comments = [];
                currentTask.comments.unshift(newComment); // Add to top
                renderComments(currentTask.comments);
            }

            modalCommentInput.value = '';
            fetchTasks(); // Background refresh to update comment counts
        } catch (err) {
            console.error(err);
            flash('Could not post the comment.', 'error');
        }
    });

    // --- Calendar Logic ---
    const calGrid = document.getElementById('calendar-grid');
    const calMonthTitle = document.getElementById('cal-month-title');
    const btnPrevMonth = document.getElementById('cal-prev');
    const btnNextMonth = document.getElementById('cal-next');

    let currentCalDate = new Date();

    function renderCalendar() {
        if (!calGrid) return;
        calGrid.innerHTML = '';

        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();

        calMonthTitle.textContent = currentCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sun

        // Previous Month Padding
        for (let i = 0; i < startDayOfWeek; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day other-month';
            calGrid.appendChild(div);
        }

        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            if (isCurrentMonth && day === today.getDate()) div.classList.add('today');

            div.innerHTML = `<div class="day-number">${day}</div>`;

            // Click to create task on this day
            div.addEventListener('click', () => {
                // Format: YYYY-MM-DD
                const m = month + 1;
                const dateStr = `${year}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
                openCreateTaskModal(dateStr);
            });

            // Find tasks for this day
            const daysTasks = currentTasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
            });

            daysTasks.forEach(task => {
                const pill = document.createElement('div');
                pill.className = `calendar-task-pill ${task.status === 'done' ? 'status-done' : ''}`;
                pill.textContent = task.title;
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskModal(task);
                });
                div.appendChild(pill);
            });

            calGrid.appendChild(div);
        }
    }

    if (btnPrevMonth) {
        btnPrevMonth.addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (btnNextMonth) {
        btnNextMonth.addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // Refresh calendar when tasks change or view switches
    const viewCalendarBtn = document.querySelector('.crm-nav-item[data-view="calendar"]');
    if (viewCalendarBtn) {
        viewCalendarBtn.addEventListener('click', () => {
            setTimeout(renderCalendar, 100);
        });
    }

    // --- CSV Import Logic ---
    const importLeadsBtn = document.getElementById('import-leads-btn');
    const importModal = document.getElementById('import-modal');
    const closeImportModalBtn = document.getElementById('close-import-modal-btn');
    const cancelImportBtn = document.getElementById('cancel-import-btn');
    const csvFileInput = document.getElementById('csv-file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const startImportBtn = document.getElementById('start-import-btn');
    const importProgress = document.getElementById('import-progress');
    const importProgressBar = document.getElementById('import-progress-bar');
    const importStatus = document.getElementById('import-status');
    const importResult = document.getElementById('import-result');
    const importResultText = document.getElementById('import-result-text');

    let selectedFile = null;

    function openImportModal() {
        importModal.style.display = 'flex';
        resetImportModal();
    }

    function closeImportModal() {
        importModal.style.display = 'none';
        resetImportModal();
    }

    function resetImportModal() {
        selectedFile = null;
        csvFileInput.value = '';
        fileNameDisplay.textContent = '';
        startImportBtn.disabled = true;
        importProgress.hidden = true;
        importResult.hidden = true;
        importProgressBar.style.width = '0%';
    }

    if (importLeadsBtn) {
        importLeadsBtn.addEventListener('click', openImportModal);
    }

    if (closeImportModalBtn) {
        closeImportModalBtn.addEventListener('click', closeImportModal);
    }

    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', closeImportModal);
    }

    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) closeImportModal();
        });
    }

    if (csvFileInput) {
        csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.name.endsWith('.csv')) {
                    flash('That is not a CSV file.', 'error');
                    csvFileInput.value = '';
                    return;
                }
                selectedFile = file;
                fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                startImportBtn.disabled = false;
            } else {
                selectedFile = null;
                fileNameDisplay.textContent = '';
                startImportBtn.disabled = true;
            }
        });
    }

    if (startImportBtn) {
        startImportBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            // Show progress
            importProgress.hidden = false;
            importResult.hidden = true;
            startImportBtn.disabled = true;
            cancelImportBtn.disabled = true;

            // Animate progress bar
            importProgressBar.style.width = '30%';
            importStatus.textContent = 'Sending the file…';

            try {
                const formData = new FormData();
                formData.append('csvFile', selectedFile);

                importProgressBar.style.width = '60%';
                importStatus.textContent = 'Reading the rows…';

                const result = await api.upload(`${API_BASE}/api/import-csv`, formData);

                importProgressBar.style.width = '100%';

                // Show success result
                importProgress.hidden = true;
                importResult.hidden = false;
                importResult.className = 'import-result is-ok';

                importResultText.innerHTML = `
                    <div class="result-headline">${result.successCount} leads imported</div>
                    <div class="result-detail">${result.totalParsed} rows read${result.errorCount ? `, ${result.errorCount} skipped` : ''}</div>
                    ${result.errors && result.errors.length ? `
                        <ul class="result-reasons">
                            ${result.errors.map(e => `<li>Row ${e.line} — ${esc(e.reason)}</li>`).join('')}
                        </ul>` : ''}
                `;

                // Refresh leads table
                setTimeout(() => {
                    fetchLeads();
                    closeImportModal();
                }, 2000);

            } catch (error) {
                console.error('Import error:', error);

                // Show error result
                importProgress.hidden = true;
                importResult.hidden = false;
                importResult.className = 'import-result is-error';

                importResultText.innerHTML = `
                    <div class="result-headline">Import failed</div>
                    <div class="result-detail">${esc(error.message)}</div>
                `;

                startImportBtn.disabled = false;
                cancelImportBtn.disabled = false;
            }
        });
    }

    // Initial Load
    fetchLeads(false);
    fetchRequests();
    fetchTasks().then(renderCalendar);
    loadColleagues();
});
