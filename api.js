/*
 * Shared browser-side API client for the CRM and the admin panel.
 *
 * Two things live here rather than in each page:
 *
 *  - credentials: 'include' on every request. The session is an httpOnly
 *    cookie now, not a token in localStorage, so a fetch that forgets this
 *    silently 401s. One place to forget it is better than thirty.
 *
 *  - the escape and format helpers both pages need. esc() in particular is not
 *    optional: lead names and messages arrive from a public form and are
 *    rendered into innerHTML in half a dozen places.
 */
(function () {
    'use strict';

    function redirectToLogin() {
        try {
            localStorage.removeItem('crm_token'); // legacy - no longer written
            localStorage.removeItem('crm_user');
        } catch (e) { /* private mode */ }
        if (!/login\.html$/.test(window.location.pathname)) {
            window.location.href = 'login.html';
        }
    }

    async function request(method, url, body, options) {
        const opts = Object.assign({
            method: method,
            credentials: 'include',
            headers: {}
        }, options || {});

        if (body instanceof FormData) {
            opts.body = body; // let the browser set the multipart boundary
        } else if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }

        const res = await fetch(url, opts);

        /* A 401 means the session is gone; a 403 on an /api/admin call just
           means this user is not an admin, which is not a reason to throw them
           out of the CRM they are legitimately signed in to. */
        if (res.status === 401) {
            redirectToLogin();
            throw new Error('Your session has expired.');
        }

        let data = null;
        const type = res.headers.get('content-type') || '';
        if (type.indexOf('application/json') !== -1) {
            data = await res.json().catch(function () { return null; });
        }

        if (!res.ok) {
            const err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
            err.status = res.status;
            err.data = data;
            throw err;
        }

        return data;
    }

    // Cache-busting for GETs: the CRM reads back its own writes immediately and
    // a 304 from the browser cache shows the state before the change.
    function bust(url) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now();
    }

    window.api = {
        get: function (url) { return request('GET', bust(url)); },
        post: function (url, body) { return request('POST', url, body); },
        put: function (url, body) { return request('PUT', url, body); },
        patch: function (url, body) { return request('PATCH', url, body); },
        del: function (url, body) { return request('DELETE', url, body); },
        upload: function (url, formData) { return request('POST', url, formData); },
        logout: async function () {
            try { await request('POST', '/api/auth/logout'); } catch (e) { /* leaving anyway */ }
            try { localStorage.removeItem('crm_user'); } catch (e) { /* ignore */ }
            window.location.href = 'login.html';
        }
    };

    window.fmt = {
        // Never trust a string that came from a public form as markup.
        esc: function (str) {
            return String(str === null || str === undefined ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        timeAgo: function (iso) {
            if (!iso) return '';
            const then = new Date(iso);
            const mins = Math.floor((Date.now() - then.getTime()) / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return mins + 'm ago';
            if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
            if (mins < 43200) return Math.floor(mins / 1440) + 'd ago';
            return then.toLocaleDateString();
        },

        date: function (iso) {
            return iso ? new Date(iso).toLocaleDateString() : '';
        },

        dateTime: function (iso) {
            return iso ? new Date(iso).toLocaleString() : '';
        },

        statusClass: function (status) {
            switch (status) {
                case 'new': return 'status-pill status-new';
                case 'contacted': return 'status-pill status-contacted';
                case 'qualified': return 'status-pill status-qualified';
                case 'proposal_sent': return 'status-pill status-proposal_sent';
                case 'won': return 'status-pill status-won';
                case 'lost': return 'status-pill status-lost';
                default: return 'status-pill';
            }
        },

        // "proposal_sent" -> "proposal sent", for display only.
        label: function (value) {
            return String(value || '').replace(/_/g, ' ');
        }
    };
}());
