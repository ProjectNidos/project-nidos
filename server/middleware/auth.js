const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-change-me';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, SECRET_KEY, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token.' });
        }

        // Optional: check if user still exists in DB
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser) {
            return res.status(403).json({ error: 'User no longer exists.' });
        }

        req.user = dbUser;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admins only.' });
    }
};

module.exports = { authenticateToken, isAdmin, SECRET_KEY };
