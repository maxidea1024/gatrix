import express from 'express';
import serviceDiscoveryService from '../../services/serviceDiscoveryService';

const router = express.Router();

// GET /api/v1/public/monitoring/prometheus/targets
// Returns HTTP service discovery target groups for Prometheus
router.get('/prometheus/targets', async (_req, res) => {
  try {
    const services = await serviceDiscoveryService.getServices();

    // Build discovered targets with per-instance labels (service, instanceId, hostname, ip)
    const groups: Array<{ targets: string[]; labels?: Record<string, string> }> = [];

    for (const s of services) {
      const serviceType = s.labels.service || 'unknown';
      // Choose port for metrics
      // All services expose /metrics on their main HTTP ports
      let port = 80;
      const metricsPath = '/metrics';
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
      const labels: Record<string, string> = {
        service: serviceType,
        metrics_path: metricsPath,
      };

      if (s.instanceId) {
        labels.instanceId = s.instanceId;
      }
      if (s.hostname) {
        labels.hostname = s.hostname;
      }
      if (s.internalAddress) {
        labels.ip = s.internalAddress;
      }
      if (s.externalAddress) {
        labels.externalIp = s.externalAddress;
      }
      if (s.labels.group) {
        labels.group = s.labels.group;
      }

      groups.push({
        targets: [target],
        labels,
      });
    }

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

