const API_BASE = '/api';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
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
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('crm_token', data.token);
            localStorage.setItem('crm_user', JSON.stringify(data.user));

            window.location.href = 'crm.html';
        } catch (err) {
            showError(err.message);
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Registration failed');

            // Auto-login after register? Or redirect to login? 
            // Let's redirect to login for simplicity, or just alert success.
            alert('Account created! Please sign in.');
            window.location.href = 'login.html';
        } catch (err) {
            showError(err.message);
        }
    });
}
