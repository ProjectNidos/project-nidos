/*
 * Sign-in. The server answers a successful login by setting an httpOnly
 * session cookie, which this page deliberately never sees and never stores -
 * the token used to live in localStorage, where any injected script could read
 * it. Only the display name is kept locally, and only to fill the sidebar.
 */
const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');

function showError(msg) {
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    } else {
        alert(msg);
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
        }

        try {
            const data = await window.api.post('/api/auth/login', { email, password });

            try {
                localStorage.setItem('crm_user', JSON.stringify(data.user));
            } catch (err) { /* private mode - the sidebar just says "Account" */ }

            // Admins land on the panel, everyone else on the CRM.
            window.location.href = data.user && data.user.role === 'admin'
                ? 'admin.html'
                : 'crm.html';
        } catch (err) {
            showError(err.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        }
    });
}
