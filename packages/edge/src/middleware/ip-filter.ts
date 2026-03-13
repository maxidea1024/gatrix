import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';
import net from 'net';

const logger = createLogger('IpFilter');

interface CidrRange {
  addr: number[];
  prefixLen: number;
  isV6: boolean;
}

/**
 * Parse a CIDR string (e.g., "10.0.0.0/8" or "192.168.1.1")
 */
function parseCidr(s: string): CidrRange | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  const [addrStr, prefixStr] = trimmed.split('/');

  if (net.isIPv4(addrStr)) {
    const parts = addrStr.split('.').map(Number);
    if (parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
    const prefixLen = prefixStr ? parseInt(prefixStr, 10) : 32;
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
    return { addr: parts, prefixLen, isV6: false };
  }

  // IPv6 is less common for Edge, skip for now
  return null;
}

/**
 * Check if an IPv4 address matches a CIDR range
 */
function cidrContains(cidr: CidrRange, ip: string): boolean {
  if (cidr.isV6) return false;

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p))) return false;

  // Convert to 32-bit integers
  const ipNum =
    (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const cidrNum =
    (cidr.addr[0] << 24) |
    (cidr.addr[1] << 16) |
    (cidr.addr[2] << 8) |
    cidr.addr[3];

  if (cidr.prefixLen === 0) return true;
  const mask = ~0 << (32 - cidr.prefixLen);
  return (ipNum & mask) === (cidrNum & mask);
}

/**
 * Parse a comma-separated list of CIDRs
 */
function parseCidrList(s: string): CidrRange[] {
  if (!s) return [];
  return s
    .split(',')
    .map((part) => parseCidr(part))
    .filter((c): c is CidrRange => c !== null);
}

/**
 * Normalize IP address (strip IPv6 prefix like ::ffff:)
 */
function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
}

/**
 * Create an IP filter middleware.
 * When both lists are empty, the middleware is a pass-through.
 */
export function createIpFilter(allowIps: string, denyIps: string) {
  const allowList = parseCidrList(allowIps);
  const denyList = parseCidrList(denyIps);

  if (allowList.length > 0) {
    logger.info(`IP allow list configured with ${allowList.length} entries`);
  }
  if (denyList.length > 0) {
    logger.info(`IP deny list configured with ${denyList.length} entries`);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowList.length === 0 && denyList.length === 0) {
      next();
      return;
    }

    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = normalizeIp(rawIp);

    // Check deny list first
    if (
      denyList.length > 0 &&
      denyList.some((cidr) => cidrContains(cidr, clientIp))
    ) {
      logger.warn(`IP denied by deny list: ${clientIp}`);
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
      return;
    }

    // Check allow list
    if (
      allowList.length > 0 &&
      !allowList.some((cidr) => cidrContains(cidr, clientIp))
    ) {
      logger.warn(`IP not in allow list: ${clientIp}`);
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
      return;
    }

    next();
  };
}
