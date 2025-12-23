/**
 * Cloud Metadata Detection Utility
 * Detects cloud provider and retrieves instance metadata (region, zone, instance ID, etc.)
 * Supports AWS, GCP, Azure, Tencent Cloud, Alibaba Cloud, and Oracle Cloud.
 */

import * as http from 'http';

// Cloud provider types
export type CloudProvider =
    | 'aws'
    | 'gcp'
    | 'azure'
    | 'tencentcloud'
    | 'alibabacloud'
    | 'oraclecloud'
    | 'unknown';

// Metadata endpoints for each cloud provider
const METADATA_ENDPOINTS = {
    aws: {
        base: 'http://169.254.169.254',
        // IMDSv1 endpoint (simpler, no token required)
        identity: '/latest/dynamic/instance-identity/document',
        timeout: 1000,
    },
    gcp: {
        base: 'http://169.254.169.254',
        zone: '/computeMetadata/v1/instance/zone',
        instanceId: '/computeMetadata/v1/instance/id',
        projectId: '/computeMetadata/v1/project/project-id',
        timeout: 1000,
        headers: {
            'Metadata-Flavor': 'Google',
        },
    },
    azure: {
        base: 'http://169.254.169.254',
        instance: '/metadata/instance?api-version=2021-02-01',
        timeout: 1000,
        headers: {
            'Metadata': 'true',
        },
    },
    tencentcloud: {
        base: 'http://metadata.tencentyun.com',
        region: '/latest/meta-data/placement/region',
        zone: '/latest/meta-data/placement/zone',
        instanceId: '/latest/meta-data/instance-id',
        timeout: 1000,
    },
    alibabacloud: {
        base: 'http://100.100.100.200',
        region: '/latest/meta-data/region-id',
        zone: '/latest/meta-data/zone-id',
        instanceId: '/latest/meta-data/instance-id',
        instanceType: '/latest/meta-data/instance/instance-type',
        timeout: 1000,
    },
    oraclecloud: {
        base: 'http://169.254.169.254',
        instance: '/opc/v2/instance/',
        timeout: 1000,
        headers: {
            'Authorization': 'Bearer Oracle',
        },
    },
} as const;

// Cloud instance metadata result
export interface CloudMetadata {
    provider: CloudProvider;
    region?: string;
    zone?: string;
    instanceId?: string;
    instanceType?: string;
    // AWS specific
    accountId?: string;
    // GCP specific
    projectId?: string;
    // Azure specific
    subscriptionId?: string;
    resourceGroup?: string;
    vmName?: string;
    // Oracle Cloud specific
    compartmentId?: string;
    tenancyId?: string;
}

/**
 * Make HTTP GET request with timeout
 * Returns null on any error (timeout, connection refused, etc.)
 */
function httpGet(
    url: string,
    options: { timeout: number; headers?: Record<string, string> }
): Promise<string | null> {
    return new Promise((resolve) => {
        const parsedUrl = new URL(url);

        const req = http.get(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: options.timeout,
                headers: options.headers,
            },
            (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }

                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(data);
                });
            }
        );

        req.on('error', () => {
            resolve(null);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

/**
 * Detect AWS EC2 metadata
 */
async function detectAWS(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.aws;
    const url = `${endpoint.base}${endpoint.identity}`;

    const response = await httpGet(url, { timeout: endpoint.timeout });
    if (!response) {
        return null;
    }

    try {
        const doc = JSON.parse(response);
        return {
            provider: 'aws',
            region: doc.region,
            zone: doc.availabilityZone,
            instanceId: doc.instanceId,
            instanceType: doc.instanceType,
            accountId: doc.accountId,
        };
    } catch {
        return null;
    }
}

/**
 * Detect GCP Compute Engine metadata
 */
async function detectGCP(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.gcp;

    // GCP zone format: projects/PROJECT_NUM/zones/ZONE
    // Example: projects/123456789/zones/us-central1-a
    const zoneResponse = await httpGet(`${endpoint.base}${endpoint.zone}`, {
        timeout: endpoint.timeout,
        headers: endpoint.headers,
    });

    if (!zoneResponse) {
        return null;
    }

    // Parse zone to extract region
    // Zone format: projects/123456789/zones/us-central1-a
    // Region is derived from zone: us-central1
    const zoneParts = zoneResponse.split('/');
    const zone = zoneParts[zoneParts.length - 1]; // e.g., "us-central1-a"

    // Extract region from zone (remove the last part after the last hyphen)
    // us-central1-a -> us-central1
    const zoneSplit = zone.split('-');
    const region = zoneSplit.length >= 3
        ? zoneSplit.slice(0, -1).join('-')
        : zone;

    // Get instance ID
    const instanceId = await httpGet(`${endpoint.base}${endpoint.instanceId}`, {
        timeout: endpoint.timeout,
        headers: endpoint.headers,
    });

    // Get project ID
    const projectId = await httpGet(`${endpoint.base}${endpoint.projectId}`, {
        timeout: endpoint.timeout,
        headers: endpoint.headers,
    });

    return {
        provider: 'gcp',
        region,
        zone,
        instanceId: instanceId || undefined,
        projectId: projectId || undefined,
    };
}

/**
 * Detect Azure VM metadata
 */
async function detectAzure(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.azure;
    const url = `${endpoint.base}${endpoint.instance}`;

    const response = await httpGet(url, {
        timeout: endpoint.timeout,
        headers: endpoint.headers,
    });

    if (!response) {
        return null;
    }

    try {
        const doc = JSON.parse(response);
        const compute = doc.compute || {};

        return {
            provider: 'azure',
            region: compute.location, // Azure uses 'location' instead of 'region'
            zone: compute.zone || undefined,
            instanceId: compute.vmId,
            instanceType: compute.vmSize,
            subscriptionId: compute.subscriptionId,
            resourceGroup: compute.resourceGroupName,
            vmName: compute.name,
        };
    } catch {
        return null;
    }
}

/**
 * Detect Tencent Cloud CVM metadata
 */
async function detectTencentCloud(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.tencentcloud;

    // Try to get region first
    const regionResponse = await httpGet(`${endpoint.base}${endpoint.region}`, {
        timeout: endpoint.timeout,
    });

    if (!regionResponse) {
        return null;
    }

    // Get zone
    const zoneResponse = await httpGet(`${endpoint.base}${endpoint.zone}`, {
        timeout: endpoint.timeout,
    });

    // Get instance ID
    const instanceIdResponse = await httpGet(`${endpoint.base}${endpoint.instanceId}`, {
        timeout: endpoint.timeout,
    });

    return {
        provider: 'tencentcloud',
        region: regionResponse,
        zone: zoneResponse || undefined,
        instanceId: instanceIdResponse || undefined,
    };
}

/**
 * Detect Alibaba Cloud ECS metadata
 */
async function detectAlibabaCloud(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.alibabacloud;

    // Try to get region first
    const regionResponse = await httpGet(`${endpoint.base}${endpoint.region}`, {
        timeout: endpoint.timeout,
    });

    if (!regionResponse) {
        return null;
    }

    // Get zone
    const zoneResponse = await httpGet(`${endpoint.base}${endpoint.zone}`, {
        timeout: endpoint.timeout,
    });

    // Get instance ID
    const instanceIdResponse = await httpGet(`${endpoint.base}${endpoint.instanceId}`, {
        timeout: endpoint.timeout,
    });

    // Get instance type
    const instanceTypeResponse = await httpGet(`${endpoint.base}${endpoint.instanceType}`, {
        timeout: endpoint.timeout,
    });

    return {
        provider: 'alibabacloud',
        region: regionResponse,
        zone: zoneResponse || undefined,
        instanceId: instanceIdResponse || undefined,
        instanceType: instanceTypeResponse || undefined,
    };
}

/**
 * Detect Oracle Cloud Infrastructure (OCI) metadata
 */
async function detectOracleCloud(): Promise<CloudMetadata | null> {
    const endpoint = METADATA_ENDPOINTS.oraclecloud;
    const url = `${endpoint.base}${endpoint.instance}`;

    const response = await httpGet(url, {
        timeout: endpoint.timeout,
        headers: endpoint.headers,
    });

    if (!response) {
        return null;
    }

    try {
        const doc = JSON.parse(response);

        return {
            provider: 'oraclecloud',
            region: doc.region || doc.canonicalRegionName,
            zone: doc.availabilityDomain,
            instanceId: doc.id,
            instanceType: doc.shape,
            compartmentId: doc.compartmentId,
            tenancyId: doc.tenancyId,
        };
    } catch {
        return null;
    }
}

/**
 * Auto-detect cloud provider and retrieve metadata
 * Tries each provider in sequence until one succeeds
 * Returns metadata with provider='unknown' if no cloud provider is detected
 *
 * @param preferredProvider Optional preferred provider to try first
 */
export async function detectCloudMetadata(
    preferredProvider?: CloudProvider
): Promise<CloudMetadata> {
    // Default result for non-cloud environments
    const defaultResult: CloudMetadata = { provider: 'unknown' };

    // If preferred provider is specified, try it first
    if (preferredProvider && preferredProvider !== 'unknown') {
        const detectors: Record<Exclude<CloudProvider, 'unknown'>, () => Promise<CloudMetadata | null>> = {
            aws: detectAWS,
            gcp: detectGCP,
            azure: detectAzure,
            tencentcloud: detectTencentCloud,
            alibabacloud: detectAlibabaCloud,
            oraclecloud: detectOracleCloud,
        };

        const detector = detectors[preferredProvider];
        if (detector) {
            try {
                const result = await detector();
                if (result) {
                    return result;
                }
            } catch {
                // Silently ignore errors
            }
        }
    }

    // Try all providers in sequence
    // Order: AWS (most common) -> GCP -> Azure -> Alibaba -> Tencent -> Oracle
    const detectorsInOrder = [
        detectAWS,
        detectGCP,
        detectAzure,
        detectAlibabaCloud,
        detectTencentCloud,
        detectOracleCloud,
    ];

    for (const detector of detectorsInOrder) {
        try {
            const result = await detector();
            if (result) {
                return result;
            }
        } catch {
            // Silently ignore errors, continue to next provider
        }
    }

    return defaultResult;
}

/**
 * Check if region is specified or needs auto-detection
 */
export function needsRegionDetection(region?: string): boolean {
    return !region || region === '' || region === 'unspecified-region';
}
