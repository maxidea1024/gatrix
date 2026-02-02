import * as os from "os";

/**
 * Get the first non-internal IPv4 address from network interfaces
 * Falls back to first internal IPv4 address if no external address is found
 */
export function getFirstNicAddress(): string {
  const interfaces = os.networkInterfaces();

  // First pass: Look for non-internal IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      // Skip non-IPv4 and internal addresses
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Second pass: Fall back to internal IPv4 addresses (e.g., 127.0.0.1)
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === "IPv4") {
        return addr.address;
      }
    }
  }

  // Ultimate fallback
  return "127.0.0.1";
}
