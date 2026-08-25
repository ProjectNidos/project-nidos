/*
 * Everything under /api/admin.
 *
 * The guard is applied once, here, at the router level - so a new sub-route
 * file cannot forget it. Nothing mounted below this line is reachable without
 * an active admin session.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.use(authenticateToken, isAdmin);

router.use('/users', require('./users'));
router.use('/stats', require('./stats'));
router.use('/audit', require('./audit'));
router.use('/data', require('./data'));
router.use('/content', require('./content'));
router.use('/settings', require('./settings'));

module.exports = router;
