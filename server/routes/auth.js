const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { SECRET_KEY, authenticateToken, isAdmin } = require('../middleware/auth');
const prisma = require('../prisma');
const audit = require('../lib/audit');
const users = require('../lib/users');

const IS_DEV = process.env.NODE_ENV === 'development';

/* Deprecated: the admin panel's Users view (POST /api/admin/users) is where
   accounts are made now. Kept as an alias because it is admin-only and any
   external tooling pointed at it keeps working - both paths run the same
   validation in server/lib/users.js. */
router.post('/register', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await users.create(req.body);
        await audit.record(req, {
            action: 'user.create',
            entityType: 'User',
            entityId: user.id,
            summary: `Created ${user.role} ${user.email} (via /auth/register)`,
            after: user
        });
        res.status(201).json(user);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// Login - Rate limited via server.js middleware
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Use generic error to prevent user enumeration
            await audit.record(req, {
                action: 'auth.login_failed',
                summary: `Failed sign-in for ${email} (no such account)`
            });
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await audit.record(req, {
                action: 'auth.login_failed',
                actorId: user.id,
                entityType: 'User',
                entityId: user.id,
                summary: `Failed sign-in for ${email} (wrong password)`
            });
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        /* Deactivated accounts are stopped at the door as well as at the
           middleware - otherwise a disabled colleague gets a token and a
           working-looking login before their first request 403s. */
        if (user.isActive === false) {
            await audit.record(req, {
                action: 'auth.login_blocked',
                actorId: user.id,
                entityType: 'User',
                entityId: user.id,
                summary: `Deactivated account ${email} attempted sign-in`
            });
            return res.status(403).json({ error: 'This account has been deactivated.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        /* The session lives in this cookie, not in localStorage, so an injected
           script on any page cannot read the token. sameSite:'strict' is what
           stands in for a CSRF token - no cross-site request carries it.
           `secure` is off in development only: over plain http://localhost a
           Secure cookie is dropped by the browser and every login silently
           fails to stick. */
        res.cookie('token', token, {
            httpOnly: true,
            secure: !IS_DEV,
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        await audit.record(req, {
            action: 'auth.login',
            actorId: user.id,
            entityType: 'User',
            entityId: user.id,
            summary: `${user.email} signed in`
        });

        /* The token still rides in the body for the standalone import script,
           which has no cookie jar. The browser ignores it - auth.js no longer
           stores it, and every fetch sends the cookie instead. */
        const { password: _, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// Me
router.get('/me', authenticateToken, (req, res) => {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
});

// Logout
router.post('/logout', (req, res) => {
    /* clearCookie only matches a cookie whose attributes match the ones it was
       set with - drop the options and the session cookie survives the logout. */
    res.clearCookie('token', {
        httpOnly: true,
        secure: !IS_DEV,
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
