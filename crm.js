document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:4000';
    let currentTasks = [];
    let currentDragInfo = null;
    let activeTaskId = null;

    // --- Auth Check ---
    const token = localStorage.getItem('crm_token');
    const userStr = localStorage.getItem('crm_user');
    if (!token) {
        window.location.href = 'login.html';
    }

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const userDisplay = document.getElementById('user-display');
            if (userDisplay) userDisplay.textContent = user.name || user.email;
        } catch (e) { console.error('Error parsing user data'); }
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

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
    function openCreateTaskModal(dateStr = '') {
        createTaskModal.style.display = 'flex';
        document.getElementById('task-title').focus();
        if (dateStr) {
            document.getElementById('task-due').value = dateStr;
        } else {
            document.getElementById('task-due').value = '';
        }
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

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        window.location.href = 'login.html';
    });

    // --- Leads Logic ---
    function statusClass(status) {
        switch (status) {
            case 'new': return 'status-pill status-new';
            case 'contacted': return 'status-pill status-contacted';
            case 'qualified': return 'status-pill status-qualified';
            case 'proposal_sent': return 'status-pill status-proposal_sent';
            case 'won': return 'status-pill status-won';
            case 'lost': return 'status-pill status-lost';
            default: return 'status-pill';
        }
    }

    async function fetchLeads() {
        const params = new URLSearchParams();
        if (filterStatus.value) params.append('status', filterStatus.value);
        if (filterQ.value.trim()) params.append('q', filterQ.value.trim());
        const url = `${API_BASE}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;

        try {
            const res = await fetch(url, { headers });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('crm_token');
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            renderLeads(data);
        } catch (err) {
            console.error('Failed to fetch leads', err);
            leadTbody.innerHTML = `<tr><td colspan="6" class="crm-empty" style="color:var(--status-lost-color)">Error loading leads: ${err.message}</td></tr>`;
        }
    }

    function renderLeads(leads) {
        if (!Array.isArray(leads) || leads.length === 0) {
            leadTbody.innerHTML = '<tr><td colspan="6" class="crm-empty">No leads found.</td></tr>';
            if (leadCountBadge) leadCountBadge.textContent = '0 leads';
            return;
        }

        if (leadCountBadge) leadCountBadge.textContent = `${leads.length} lead${leads.length === 1 ? '' : 's'}`;
        leadTbody.innerHTML = '';

        leads.forEach(lead => {
            const tr = document.createElement('tr');
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
                <td>
                    <div class="font-medium" style="color:#fff;">${lead.fullName || '(no name)'} </div>
                    <div class="text-xs text-muted">ID: ${lead.id}</div>
                </td>
                <td>
                    <div style="font-size:13px;">${lead.email || ''}</div>
                    <div class="text-xs text-muted">${lead.phone || ''}</div>
                </td>
                <td><span class="crm-badge">${lead.source || 'manual'}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="${statusClass(status)}">${status.replace('_', ' ')}</span>
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

    leadTbody.addEventListener('change', async (e) => {
        if (e.target.matches('select[data-lead-id]')) {
            const leadId = e.target.getAttribute('data-lead-id');
            const status = e.target.value;
            try {
                await fetch(`${API_BASE}/api/leads/${leadId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ status }),
                });
                fetchLeads();
            } catch (err) { console.error(err); alert('Failed to update status'); }
        }
    });

    leadTbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-delete-lead]');
        if (btn && confirm('Delete this lead?')) {
            const leadId = btn.getAttribute('data-delete-lead');
            try {
                await fetch(`${API_BASE}/api/leads/${leadId}`, { method: 'DELETE', headers });
                fetchLeads();
            } catch (err) { console.error(err); alert('Failed to delete lead'); }
        }
    });

    filterStatus.addEventListener('change', fetchLeads);
    filterQ.addEventListener('input', () => {
        clearTimeout(filterQ._debounceTimer);
        filterQ._debounceTimer = setTimeout(fetchLeads, 300);
    });

    // --- Tasks / Kanban Logic ---

    // Toggle Task Form - Removed old logic, now using openCreateTaskModal

    async function fetchTasks() {
        try {
            const res = await fetch(`${API_BASE}/api/tasks`, { headers });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('crm_token');
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            currentTasks = await res.json();
            renderKanban(currentTasks);
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

        div.innerHTML = `
            <div class="kanban-actions">
                <button class="crm-btn-primary stop-prop" data-delete-task="${task.id}" style="width:20px; height:20px; font-size:10px; padding:0; background:rgba(239, 68, 68, 0.2); color:#ef4444;">✕</button>
            </div>
            <div class="kanban-card-title">${task.title}</div>
            <div class="kanban-card-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${task.description || 'No description'}</div>
            <div class="kanban-card-meta">
                <div class="kanban-date">📅 ${dateStr || 'No Date'}</div>
                <div style="font-size:10px; opacity:0.7;">💬 ${commentCount}</div>
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

    // Drag-and-Drop Columns
    kanbanColumns.forEach(col => {
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

            if (newStatus !== currentDragInfo.originStatus) {
                // Optimistic UI Update (or simply re-fetch)
                try {
                    await fetch(`${API_BASE}/api/tasks/${currentDragInfo.id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ status: newStatus }),
                    });
                    fetchTasks();
                } catch (err) { console.error(err); alert('Failed to move task'); }
            }
        });
    });

    // Delete Task
    document.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('button[data-delete-task]');
        if (delBtn && confirm('Delete task?')) {
            const taskId = delBtn.getAttribute('data-delete-task');
            try {
                await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE', headers });
                const modal = document.getElementById('task-modal');
                if (modal.style.display === 'flex') closeModal(); // Close modal if open
                fetchTasks();
            } catch (err) { console.error(err); alert('Failed to delete task'); }
        }
    });

    // Create Task
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title').value;
        const dueDateVal = document.getElementById('task-due').value;
        const leadIdVal = document.getElementById('task-lead-id').value;
        const description = document.getElementById('task-desc').value;

        try {
            await fetch(`${API_BASE}/api/tasks`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title,
                    description,
                    dueDate: dueDateVal ? new Date(dueDateVal).toISOString() : null,
                    leadId: leadIdVal ? Number(leadIdVal) : null
                }),
            });
            taskForm.reset();
            closeCreateTaskModal();
            fetchTasks();
        } catch (err) { console.error(err); alert('Failed to create task'); }
    });

    // --- Modal Logic ---
    function openTaskModal(task) {
        activeTaskId = task.id;
        modalTaskTitle.textContent = task.title;
        modalTaskDesc.textContent = task.description || 'No description provided.';
        modalTaskStatus.value = task.status;
        modalTaskDue.textContent = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date';
        modalTaskAssignee.textContent = task.assignedToId ? `User #${task.assignedToId}` : 'Unassigned';

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
            await fetch(`${API_BASE}/api/tasks/${activeTaskId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ status: modalTaskStatus.value }),
            });
            fetchTasks(); // Refresh board
        } catch (err) { console.error(err); }
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
                    <strong>${authorName}</strong>
                    <span>${time}</span>
                </div>
                <div>${c.content}</div>
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
            const res = await fetch(`${API_BASE}/api/tasks/${activeTaskId}/comments`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content })
            });

            if (!res.ok) throw new Error('Failed to post comment');

            const newComment = await res.json();

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
            alert('Could not post comment.');
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

    // Initial Load
    fetchLeads();
    fetchTasks().then(renderCalendar);
});
