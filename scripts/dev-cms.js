#!/usr/bin/env node
// The local server on the development database. See scripts/lib/dev-db.js.
require('./lib/dev-db').useDevDatabase();
process.env.PORT = process.env.PORT || '4031';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
require('../server.js');
