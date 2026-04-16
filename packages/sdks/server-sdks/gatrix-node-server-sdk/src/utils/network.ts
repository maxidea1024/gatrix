import * as os from 'os';
import * as http from 'http';

/**
 * Check if an IP address is a link-local address (169.254.x.x)
 * These are used by cloud metadata services and ECS task metadata,
 * and should not be reported as the container's actual IP.
 */
function isLinkLocal(address: string): boolean {
  return address.startsWith('169.254.');
}

/**
 * Get the first non-internal, non-link-local IPv4 address from network interfaces.
 * In AWS ECS Fargate, falls back to the ECS task metadata endpoint to get the real ENI IP.
 * Falls back to first internal IPv4 address if no suitable address is found.
 */
export function getFirstNicAddress(): string {
  const interfaces = os.networkInterfaces();

  // First pass: Look for non-internal, non-link-local IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal && !isLinkLocal(addr.address)) {
        return addr.address;
      }
    }
  }

  // Second pass: Fall back to internal IPv4 addresses (e.g., 127.0.0.1),
  // but still skip link-local
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === 'IPv4' && !isLinkLocal(addr.address)) {
        return addr.address;
      }
    }
  }

  // Ultimate fallback
  return '127.0.0.1';
}

/**
 * Get the container's IP address in AWS ECS Fargate.
 * Uses the ECS container metadata endpoint (v4) to get the real ENI IP.
 * Falls back to getFirstNicAddress() if not in ECS or metadata is unavailable.
 */
export async function getContainerAddress(): Promise<string> {
  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;

  if (metadataUri) {
    try {
      const response = await httpGetJson(`${metadataUri}/task`);
      if (response?.Containers) {
        // Find our container (first one with a non-link-local IPv4)
        for (const container of response.Containers) {
          const networks = container.Networks;
          if (!networks) continue;

          for (const network of networks) {
            if (network.IPv4Addresses) {
              for (const ip of network.IPv4Addresses) {
                if (!isLinkLocal(ip)) {
                  return ip;
                }
              }
            }
          }
        }
      }
    } catch {
      // Fall through to NIC detection
    }
  }

  return getFirstNicAddress();
}

/**
 * Simple HTTP GET that returns parsed JSON, with a short timeout.
 */
function httpGetJson(url: string, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.get(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
