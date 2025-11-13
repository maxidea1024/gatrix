import express from 'express';
import serviceDiscoveryService from '../../services/serviceDiscoveryService';

const router = express.Router();

// GET /api/v1/public/monitoring/prometheus/targets
// Returns HTTP service discovery target groups for Prometheus
router.get('/prometheus/targets', async (_req, res) => {
  try {
    const services = await serviceDiscoveryService.getServices();

    // Build discovered targets grouped by service type
    const groups: Array<{ targets: string[]; labels?: Record<string, string> }> = [];

    const byService: Record<string, { targets: string[]; labels: Record<string, string> }> = {};

    for (const s of services) {
      const serviceType = s.labels.service || 'unknown';
      // Choose port for metrics
      // All services expose /metrics on their main HTTP ports
      let port = 80;
      let metricsPath = '/metrics';
      if (serviceType === 'chat') {
        port = (s.ports.http && s.ports.http[0]) || 5100;
      } else if (serviceType === 'backend') {
        port = (s.ports.http && s.ports.http[0]) || 5000;
      } else if (serviceType === 'event-lens') {
        port = (s.ports.http && s.ports.http[0]) || 5200;
      } else if (serviceType === 'idle') {
        port = (s.ports.http && s.ports.http[0]) || 9999;
      } else {
        port = (s.ports.http && s.ports.http[0]) || 80;
      }

      const target = `${s.internalAddress}:${port}`;
      if (!byService[serviceType]) {
        byService[serviceType] = {
          targets: [],
          labels: { service: serviceType, metrics_path: metricsPath },
        };
      }
      byService[serviceType].targets.push(target);
    }

    Object.values(byService).forEach(group => groups.push(group));

    // Static fallback: ensure chat-server metrics are present at least
    groups.push({
      targets: ['chat-server:5100'],
      labels: { service: 'chat', metrics_path: '/metrics' },
    });

    return res.json(groups);
  } catch (err) {
    // Return empty list on error to avoid Prometheus crashes
    return res.json([]);
  }
});

export default router;

