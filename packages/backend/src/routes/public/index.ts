import express from 'express';
import uploadRoutes from './upload';

const router = express.Router();

// Public routes that don't require authentication
router.use('/upload', uploadRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Time endpoint
router.get('/time', (req, res) => {
  const clientLocalTime = req.query.clientLocalTime ? parseInt(req.query.clientLocalTime as string) : null;
  const serverLocalTime = Date.now();
  
  res.json({
    success: true,
    serverLocalTimeISO: new Date(serverLocalTime).toISOString(),
    serverLocalTime,
    clientLocalTime,
    uptime: process.uptime()
  });
});

export default router;
