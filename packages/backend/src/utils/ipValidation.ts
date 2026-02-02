import { GatrixError } from "../middleware/errorHandler";

/**
 * IP address and CIDR validation utilities
 */

/**
 * Validates if a string is a valid IPv4 address
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validates if a string is a valid IPv6 address
 */
export function isValidIPv6(ip: string): boolean {
  // More comprehensive IPv6 validation
  try {
    const parts = ip.split(":");
    if (parts.length > 8) return false;

    // Handle compressed notation
    if (ip.includes("::")) {
      const doubleParts = ip.split("::");
      if (doubleParts.length > 2) return false;
    }

    for (const part of parts) {
      if (part === "") continue; // Allow empty parts for compressed notation
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid IP address (IPv4 or IPv6)
 */
export function isValidIP(ip: string): boolean {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * Validates if a string is a valid CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  const parts = cidr.split("/");
  if (parts.length !== 2) return false;

  const [ip, prefixStr] = parts;
  const prefix = parseInt(prefixStr, 10);

  // Validate IP part
  if (!isValidIP(ip)) return false;

  // Validate prefix
  if (isNaN(prefix)) return false;

  if (isValidIPv4(ip)) {
    // IPv4 prefix should be 0-32
    return prefix >= 0 && prefix <= 32;
  } else if (isValidIPv6(ip)) {
    // IPv6 prefix should be 0-128
    return prefix >= 0 && prefix <= 128;
  }

  return false;
}

/**
 * Validates if a string is a valid IP address or CIDR notation
 */
export function isValidIPOrCIDR(input: string): boolean {
  if (!input || typeof input !== "string") return false;

  // Trim whitespace
  input = input.trim();

  // Check if it's a CIDR notation
  if (input.includes("/")) {
    return isValidCIDR(input);
  }

  // Check if it's a regular IP address
  return isValidIP(input);
}

/**
 * Normalizes IP address or CIDR notation
 * - Trims whitespace
 * - Converts to lowercase for IPv6
 * - Validates format
 */
export function normalizeIPOrCIDR(input: string): string {
  if (!input || typeof input !== "string") {
    throw new GatrixError("Invalid IP address or CIDR notation", 400);
  }

  const normalized = input.trim().toLowerCase();

  if (!isValidIPOrCIDR(normalized)) {
    throw new GatrixError("Invalid IP address or CIDR notation format", 400);
  }

  return normalized;
}

/**
 * Checks if an IP address matches a CIDR range
 */
export function ipMatchesCIDR(ip: string, cidr: string): boolean {
  try {
    // For simplicity, we'll use a basic implementation
    // In production, you might want to use a library like 'ip-range-check'

    if (!cidr.includes("/")) {
      // If it's not CIDR, just compare directly
      return ip === cidr;
    }

    const [network, prefixStr] = cidr.split("/");
    const prefix = parseInt(prefixStr, 10);

    if (isValidIPv4(ip) && isValidIPv4(network)) {
      return ipv4MatchesCIDR(ip, network, prefix);
    }

    // For IPv6, we'll implement a basic check
    // In production, consider using a proper library
    if (isValidIPv6(ip) && isValidIPv6(network)) {
      return ipv6MatchesCIDR(ip, network, prefix);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if an IPv4 address matches a CIDR range
 */
function ipv4MatchesCIDR(ip: string, network: string, prefix: number): boolean {
  const ipNum = ipv4ToNumber(ip);
  const networkNum = ipv4ToNumber(network);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Converts IPv4 address to number
 */
function ipv4ToNumber(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

/**
 * Basic IPv6 CIDR matching (simplified implementation)
 */
function ipv6MatchesCIDR(ip: string, network: string, prefix: number): boolean {
  // This is a simplified implementation
  // For production use, consider using a proper IPv6 library

  // Expand both addresses to full form
  const expandedIP = expandIPv6(ip);
  const expandedNetwork = expandIPv6(network);

  if (!expandedIP || !expandedNetwork) return false;

  // Convert to binary and compare prefix bits
  const ipBinary = ipv6ToBinary(expandedIP);
  const networkBinary = ipv6ToBinary(expandedNetwork);

  return ipBinary.substring(0, prefix) === networkBinary.substring(0, prefix);
}

/**
 * Expands IPv6 address to full form
 */
function expandIPv6(ip: string): string | null {
  try {
    // Handle :: compression
    if (ip.includes("::")) {
      const parts = ip.split("::");
      const left = parts[0] ? parts[0].split(":") : [];
      const right = parts[1] ? parts[1].split(":") : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill("0000");
      const expanded = [...left, ...middle, ...right];
      ip = expanded.join(":");
    }

    // Pad each part to 4 digits
    return ip
      .split(":")
      .map((part) => part.padStart(4, "0"))
      .join(":");
  } catch {
    return null;
  }
}

/**
 * Converts IPv6 address to binary string
 */
function ipv6ToBinary(ip: string): string {
  return ip
    .split(":")
    .map((part) => parseInt(part, 16).toString(2).padStart(16, "0"))
    .join("");
}

/**
 * Gets a human-readable description of the IP/CIDR
 */
export function getIPDescription(input: string): string {
  if (!input) return "Invalid";

  if (input.includes("/")) {
    const [ip, prefix] = input.split("/");
    if (isValidIPv4(ip)) {
      return `IPv4 network ${input} (${Math.pow(2, 32 - parseInt(prefix))} addresses)`;
    } else if (isValidIPv6(ip)) {
      return `IPv6 network ${input}`;
    }
    return `CIDR ${input}`;
  } else {
    if (isValidIPv4(input)) {
      return `IPv4 address ${input}`;
    } else if (isValidIPv6(input)) {
      return `IPv6 address ${input}`;
    }
    return `IP address ${input}`;
  }
}
