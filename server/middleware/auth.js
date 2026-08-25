const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    // This should never happen - server.js validates JWT_SECRET on startup
    throw new Error('JWT_SECRET environment variable is not set');
}

/*
 * The cookie comes first. It is httpOnly, so a script injected into any page
 * cannot read it; localStorage offered no such protection and is no longer
 * written to.
 *
 * The Authorization header is still accepted, for one reason: the standalone
 * lead-import script that runs outside the browser has no cookie jar. Anything
 * with a UI should be using the cookie.
 */
function readToken(req) {
    if (req.cookies && req.cookies.token) return req.cookies.token;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);

    return null;
}

const authenticateToken = (req, res, next) => {
    const token = readToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, SECRET_KEY, async (err, payload) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token.' });
        }

        try {
            const dbUser = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!dbUser) {
                return res.status(403).json({ error: 'User no longer exists.' });
            }
            /* An 8-hour token outlives a deactivation, so the account has to be
               re-checked on every request rather than trusted from the claim. */
            if (dbUser.isActive === false) {
                return res.status(403).json({ error: 'This account has been deactivated.' });
            }

            req.user = dbUser;
            next();
        } catch (dbErr) {
            console.error('Auth lookup failed:', dbErr.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admins only.' });
    }
};

module.exports = { authenticateToken, isAdmin, SECRET_KEY, readToken };
