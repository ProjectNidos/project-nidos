/*
 * Who may add ?__cms=1 (show the database page) or ?__cms=0 (show the file)
 * to a public URL: anyone on a development server, and on the live site only
 * a signed-in, active admin. The session cookie is httpOnly and sent with a
 * normal page load, so an admin can check a page in their own browser before
 * the switch goes on for everyone.
 *
 * The auth module is required on first use rather than at load: it refuses to
 * load without JWT_SECRET, and the development path never needs it.
 */
const jwt = require('jsonwebtoken');

function createCanPreview(prisma, env = process.env) {
  return async function canPreview(req) {
    if (env.NODE_ENV === 'development') return true;
    const { SECRET_KEY, readToken } = require('../middleware/auth');
    const token = readToken(req);
    if (!token) return false;
    try {
      const { id } = jwt.verify(token, SECRET_KEY);
      const user = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
      return Boolean(user && user.isActive !== false && user.role === 'admin');
    } catch {
      return false;
    }
  };
}

module.exports = { createCanPreview };
