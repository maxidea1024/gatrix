import axios from 'axios';
import { ScanReport, FlagDefinitionsFile } from '../types';

// ============================================================
// Backend API client for reporting results to Gatrix
// ============================================================

/**
 * Fetch flag definitions from the Gatrix backend.
 * Uses the server API: GET /api/v1/server/features/definitions
 * No environment required - returns all flags globally.
 */
export async function fetchFlagDefinitions(
  backendUrl: string,
  apiKey: string,
): Promise<FlagDefinitionsFile> {
  const baseUrl = backendUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/v1/server/features/definitions`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Application-Name': 'gatrix-flag-code-refs',
      },
      timeout: 30000,
    });

    const result = response.data;
    if (!result.success || !result.data?.flags) {
      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
    }

    // Server returns { type, flagType, archived } - map to our FlagDefinitionsFile format
    const flags: FlagDefinitionsFile['flags'] = {};
    for (const [name, def] of Object.entries(result.data.flags)) {
      const d = def as { type: string; flagType: string; archived: boolean };
      flags[name] = {
        type: d.type as 'bool' | 'string' | 'number' | 'json' | 'variant',
        archived: d.archived,
      };
    }

    return { flags };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      throw new Error(
        `Failed to fetch flag definitions (HTTP ${status}): ${JSON.stringify(data)}`,
      );
    }
    throw new Error(
      `Failed to fetch flag definitions: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Upload scan report to the Gatrix backend.
 */
export async function uploadReport(
  backendUrl: string,
  apiKey: string,
  report: ScanReport,
): Promise<{ success: boolean; message: string }> {
  const url = `${backendUrl.replace(/\/+$/, '')}/api/v1/server/features/code-references/report`;

  try {
    const response = await axios.post(url, report, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Application-Name': 'gatrix-flag-code-refs',
      },
      timeout: 30000,
      maxBodyLength: 50 * 1024 * 1024, // 50MB max
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        message: `Report uploaded successfully. Status: ${response.status}`,
      };
    }

    return {
      success: false,
      message: `Unexpected status: ${response.status}`,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      return {
        success: false,
        message: `Backend upload failed (HTTP ${status}): ${JSON.stringify(data)}`,
      };
    }

    return {
      success: false,
      message: `Backend upload failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
