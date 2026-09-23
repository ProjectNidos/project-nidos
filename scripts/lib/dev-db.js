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
    const url = line.slice('DATABASE_URL='.length).trim();
    process.env.DATABASE_URL = url;
    require('../env');
    process.env.NODE_ENV = 'development';

    const want = new URL(url).host;
    const got = new URL(process.env.DATABASE_URL).host;
    if (got !== want) {
        console.error(`✗ the env files replaced the development database (${want}) with ${got}. Stopping.`);
        process.exit(1);
    }
    console.log(`· development database: ${want}`);
    return { host: want };
}

module.exports = { useDevDatabase };
