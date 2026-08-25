/*
 * User creation and validation, in one place.
 *
 * Two doors lead here - the admin panel's Users view and the older
 * POST /api/auth/register - and scripts/seed-admin.js deliberately mirrors the
 * same rules. When the password policy changes it must change once.
 */
const bcrypt = require('bcrypt');
const prisma = require('../prisma');

const ROLES = ['admin', 'user'];
const MIN_PASSWORD = 8;
const BCRYPT_ROUNDS = 10;

// Everything the API is allowed to return about a user. Spelled out as a
// select rather than deleting `password` afterwards, so a future column is
// private until someone deliberately adds it here.
const PUBLIC_FIELDS = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    lastLogin: true,
    createdAt: true,
    updatedAt: true,
};

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Returns an error string, or null when the input is acceptable.
 */
function validate({ email, password, role }, { requirePassword = true } = {}) {
    if (email !== undefined) {
        if (!email || !validEmail(email)) return 'Invalid email format.';
    }
    if (requirePassword || password !== undefined) {
        if (!password) return 'Password is required.';
        if (password.length < MIN_PASSWORD) {
            return `Password must be at least ${MIN_PASSWORD} characters.`;
        }
    }
    if (role !== undefined && !ROLES.includes(role)) {
        return `Role must be one of: ${ROLES.join(', ')}.`;
    }
    return null;
}

function hash(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Create a user. Throws { status, message } so both callers can answer with
 * the same words.
 */
async function create({ email, password, name, role }) {
    const normalisedEmail = String(email || '').trim().toLowerCase();

    const problem = validate({ email: normalisedEmail, password, role });
    if (problem) throw Object.assign(new Error(problem), { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) {
        throw Object.assign(new Error('A user with that email already exists.'), { status: 400 });
    }

    return prisma.user.create({
        data: {
            email: normalisedEmail,
            password: await hash(password),
            name: name ? String(name).trim() : null,
            role: role || 'user',
        },
        select: PUBLIC_FIELDS,
    });
}

/**
 * How many admins could still sign in if `excludeId` were removed or demoted.
 * The last one is not allowed to go - that is how a deployment locks itself out.
 */
async function activeAdminCount(excludeId) {
    return prisma.user.count({
        where: {
            role: 'admin',
            isActive: true,
            ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
        },
    });
}

module.exports = { ROLES, MIN_PASSWORD, PUBLIC_FIELDS, validate, validEmail, hash, create, activeAdminCount };
