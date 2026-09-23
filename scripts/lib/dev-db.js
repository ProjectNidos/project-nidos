/*
 * Points this process at the development database and proves it stayed there.
 *
 * server.js loads .env and then .env.local on top (scripts/env.js), and either
 * could carry a DATABASE_URL. Setting ours first and trusting it is not enough,
 * so this loads the same chain the server loads and then compares: if the
 * database is not the one in .env.cms-dev any more, it stops before anything
 * connects. Only the host is ever printed.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '.env.cms-dev');

// Returns the URL's host, or null if the value does not parse. Never
// rethrows and never logs the value — a malformed connection string still
// carries credentials, and those must not reach the console or a crash dump.
function hostOf(value) {
    try {
        return new URL(value).host;
    } catch {
        return null;
    }
}

// .env files conventionally allow a value to be wrapped in one pair of
// quotes; strip that pair (and any surrounding whitespace) before parsing.
function stripQuotes(value) {
    const trimmed = value.trim();
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (trimmed.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

function useDevDatabase() {
    if (!fs.existsSync(FILE)) {
        console.error('✗ .env.cms-dev is missing. See Task 3 of the CMS foundation plan.');
        process.exit(1);
    }
    const line = fs.readFileSync(FILE, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
    if (!line) {
        console.error('✗ .env.cms-dev has no DATABASE_URL= line.');
        process.exit(1);
    }
    const url = stripQuotes(line.slice('DATABASE_URL='.length));
    const want = hostOf(url);
    if (!want) {
        console.error('✗ DATABASE_URL in .env.cms-dev is not a valid URL.');
        process.exit(1);
    }
    process.env.DATABASE_URL = url;
    require('../env');
    process.env.NODE_ENV = 'development';

    const got = hostOf(process.env.DATABASE_URL);
    if (!got) {
        console.error(`✗ the env files replaced the development database (${want}) with a value that is not a URL. Stopping.`);
        process.exit(1);
    }
    if (got !== want) {
        console.error(`✗ the env files replaced the development database (${want}) with ${got}. Stopping.`);
        process.exit(1);
    }
    console.log(`· development database: ${want}`);
    return { host: want };
}

module.exports = { useDevDatabase };
