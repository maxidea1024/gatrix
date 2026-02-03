import express from 'express';
import serviceDiscoveryService from '../../services/serviceDiscoveryService';

const router = express.Router();

// GET /api/v1/public/monitoring/prometheus/targets
// Returns HTTP service discovery target groups for Prometheus
router.get('/prometheus/targets', async (_req, res) => {
  try {
    const services = await serviceDiscoveryService.getServices();

    // Build discovered targets with per-instance labels (service, instanceId, hostname, ip)
    const groups: Array<{
      targets: string[];
      labels?: Record<string, string>;
    }> = [];

    for (const s of services) {
      const serviceType = s.labels.service || 'unknown';
      const metricsPath = '/metrics';

      // Only use metricsApi port (SDK standard: 9337)
      // Skip services without metricsApi port configured
      const port = s.ports.metricsApi;
      if (!port) {
        continue;
      }

      // Prometheus location configuration:
      // - PROMETHEUS_IN_DOCKER=true (default): Prometheus runs in Docker, needs host.docker.internal for host services
      // - PROMETHEUS_IN_DOCKER=false: Prometheus runs externally, use actual IP addresses
      const prometheusInDocker = process.env.PROMETHEUS_IN_DOCKER !== 'false'; // Default: true
      let targetAddress = s.internalAddress;

      if (prometheusInDocker && targetAddress) {
        // Docker internal network IPs (172.x.x.x) are accessible directly within Docker network
        // Host machine IPs (10.x.x.x, 192.168.x.x, etc.) need host.docker.internal
        const isDockerInternalNetwork = targetAddress.startsWith('172.');
        const isLocalhost = targetAddress === '127.0.0.1' || targetAddress === 'localhost';

        // Host machine services (non-Docker IPs) need host.docker.internal for Prometheus access
        if (!isDockerInternalNetwork && !isLocalhost) {
          targetAddress = 'host.docker.internal';
        }
      }

      const target = `${targetAddress}:${port}`;
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
      if (s.labels.environment) {
        labels.environment = s.labels.environment;
      }
      if (s.labels.region) {
        labels.region = s.labels.region;
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
