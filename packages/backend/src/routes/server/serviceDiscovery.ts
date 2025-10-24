/**
 * Service Discovery Server Routes
 *
 * NOTE: This file is kept for future Server SDK endpoints.
 * Service registration/heartbeat is done directly via etcd/Redis by game servers.
 */

import express from 'express';

const router = express.Router();

// No routes needed - game servers connect directly to etcd/Redis

export default router;

