/*
 * Points this process at the development database and proves it stayed there.
 *
 * server.js loads .env and then .env.local on top (scripts/env.js), and either
 * could carry a DATABASE_URL. Setting ours first and trusting it is not enough,
 * so this loads the same chain the server loads and then compares: if the
 * database is not the one in .env.cms-dev any more, it stops before anything
 * connects. It also stops if .env.cms-dev names the same host:port as the
 * server's own .env.local or .env - a copied production URL would otherwise
 * pass every check above. Only the host is ever printed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FILE = path.join(ROOT, '.env.cms-dev');
const SERVER_ENV_FILES = ['.env.local', '.env'];

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

// The unquoted value of a NAME= line in an env file's text, or null if there
// is no such line. Line-based, not dotenv, so nothing lands in process.env.
function envValue(text, name) {
    const line = text.split('\n').find((l) => l.startsWith(`${name}=`));
    return line === undefined ? null : stripQuotes(line.slice(name.length + 1));
}

// The name of the first file whose DATABASE_URL or DATABASE_PUBLIC_URL has
// the development database's host:port, or null. Pure - `files` is
// [{ name, text }] - so it is tested without a real env file anywhere near it.
function sameDatabaseAs(devHost, files) {
    for (const { name, text } of files) {
        for (const key of ['DATABASE_URL', 'DATABASE_PUBLIC_URL']) {
            const value = envValue(text, key);
            if (value && hostOf(value) === devHost) return name;
        }
    }
    return null;
}

function useDevDatabase() {
    if (!fs.existsSync(FILE)) {
        console.error('✗ .env.cms-dev is missing. See Task 3 of the CMS foundation plan.');
        process.exit(1);
    }
    const url = envValue(fs.readFileSync(FILE, 'utf8'), 'DATABASE_URL');
    if (url === null) {
        console.error('✗ .env.cms-dev has no DATABASE_URL= line.');
        process.exit(1);
    }
    const want = hostOf(url);
    if (!want) {
        console.error('✗ DATABASE_URL in .env.cms-dev is not a valid URL.');
        process.exit(1);
    }
    const serverFiles = SERVER_ENV_FILES
        .filter((name) => fs.existsSync(path.join(ROOT, name)))
        .map((name) => ({ name, text: fs.readFileSync(path.join(ROOT, name), 'utf8') }));
    const clash = sameDatabaseAs(want, serverFiles);
    if (clash) {
        console.error(`✗ .env.cms-dev points at the same database as ${clash}. Stopping.`);
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

module.exports = { useDevDatabase, sameDatabaseAs };
