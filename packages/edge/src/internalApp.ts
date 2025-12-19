import express, { Application, Request, Response, NextFunction } from 'express';
import internalRoutes from './routes/internal';
import logger from './config/logger';

// Create Express application for internal endpoints
const internalApp: Application = express();

// Disable ETag
internalApp.set('etag', false);

// Body parsing
internalApp.use(express.json({ limit: '1mb' }));

// Request logging middleware
internalApp.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`[Internal] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Mount internal routes at root (since this is a dedicated server)
internalApp.use('/', internalRoutes);

// 404 handler
internalApp.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        },
    });
});

// Error handler
internalApp.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error in internal server:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
        },
    });
});

export default internalApp;
