/*
 * Safe reads for req.query.
 *
 * Express parses the query string with qs { allowPrototypes: true }
 * (express/lib/utils.js parseExtendedQueryString), so `?status[toString]=x`
 * arrives as { toString: 'x' } - an object whose toString is a string rather
 * than a function. String(), Number() and parseInt() all run ToPrimitive on
 * that, find neither toString nor valueOf callable, and throw
 * "Cannot convert object to primitive value".
 *
 * In an async route handler that throw becomes an unhandled rejection. Express
 * 4 does not catch those, nothing in this app installs an unhandledRejection
 * handler, and Node 22 defaults to --unhandled-rejections=throw - so a single
 * request takes the whole process down. It also lets ?status[contains]=x reach
 * Prisma as a filter operator instead of a value.
 *
 * Both problems have the same root: a query value is only trustworthy when it
 * is already a primitive string. Anything else is treated as absent.
 */

function str(value) {
    return typeof value === 'string' && value !== '' ? value : undefined;
}

/* Integers only, and only from a string. Number('') is 0, which would quietly
   turn a blank filter into a real one. */
function int(value) {
    const s = str(value);
    if (s === undefined) return undefined;
    const n = Number(s);
    return Number.isInteger(n) ? n : undefined;
}

/* Clamped integer for page sizes and windows, with a fallback when absent or
   unparseable - the shape parseInt(...) || DEFAULT was reaching for. */
function intIn(value, fallback, min, max) {
    const n = int(value);
    return Math.min(Math.max(n === undefined ? fallback : n, min), max);
}

module.exports = { str, int, intIn };
