/**
 * Feature Flags Admin Routes
 * Main router that aggregates all feature flag sub-routes
 */

import { Router } from 'express';
import networkTrafficRouter from './networkTraffic';
import flagTypesRouter from './flagTypes';
import segmentsRouter from './segments';
import contextFieldsRouter from './contextFields';
import codeReferencesRouter from './codeReferences';
import playgroundRouter from './playground';
import importExportRouter from './importExport';
import flagsRouter from './flags';

const router = Router();

// Specific path prefixes (order does not matter for these)
router.use('/network', networkTrafficRouter);
router.use('/types', flagTypesRouter);
router.use('/segments', segmentsRouter);
router.use('/context-fields', contextFieldsRouter);
router.use('/code-references', codeReferencesRouter);

// Root-level routes that must be registered BEFORE /:flagName catch-all
router.use('/', playgroundRouter);
router.use('/', importExportRouter);

// /:flagName catch-all routes (MUST be last)
router.use('/', flagsRouter);

export default router;
