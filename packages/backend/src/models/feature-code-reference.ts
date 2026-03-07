/**
 * Feature Code Reference Model
 * Stores code references discovered by gatrix-flag-code-refs scanner
 */
import db from '../config/knex';
import { ulid } from 'ulid';

export interface CodeReferenceAttributes {
  id: string;
  flagName: string;
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
  codeSnippet?: string;
  functionName?: string;
  receiver?: string;
  language?: string;
  confidence: number;
  detectionStrategy?: string;
  codeUrl?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  scanId?: string;
  scanTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class FeatureCodeReferenceModel {
  /**
   * Find all code references for a specific flag
   */
  static async findByFlagName(
    flagName: string,
    options?: { repository?: string; branch?: string; limit?: number }
  ): Promise<CodeReferenceAttributes[]> {
    let query = db('g_feature_code_references')
      .where('flagName', flagName)
      .orderBy('scanTime', 'desc')
      .orderBy('filePath', 'asc')
      .orderBy('lineNumber', 'asc');

    if (options?.repository) {
      query = query.where('repository', options.repository);
    }
    if (options?.branch) {
      query = query.where('branch', options.branch);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Get summary of code references grouped by flag
   */
  static async getSummary(options?: {
    repository?: string;
    branch?: string;
  }): Promise<{ flagName: string; referenceCount: number; lastScanTime: Date }[]> {
    let query = db('g_feature_code_references')
      .select('flagName')
      .count('* as referenceCount')
      .max('scanTime as lastScanTime')
      .groupBy('flagName')
      .orderBy('flagName', 'asc');

    if (options?.repository) {
      query = query.where('repository', options.repository);
    }
    if (options?.branch) {
      query = query.where('branch', options.branch);
    }

    return query as any;
  }

  /**
   * Replace all code references for a given scan
   * (delete old refs for this repository/branch, insert new ones)
   */
  static async replaceForScan(
    scanId: string,
    repository: string,
    branch: string,
    references: Omit<CodeReferenceAttributes, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<number> {
    // Delete existing references for this repository + branch
    await db('g_feature_code_references')
      .where('repository', repository)
      .where('branch', branch)
      .del();

    if (references.length === 0) return 0;

    // Insert new references in batches of 100
    const batchSize = 100;
    for (let i = 0; i < references.length; i += batchSize) {
      const batch = references.slice(i, i + batchSize).map((ref) => ({
        id: ulid(),
        flagName: ref.flagName,
        filePath: ref.filePath,
        lineNumber: ref.lineNumber,
        columnNumber: ref.columnNumber || null,
        codeSnippet: ref.codeSnippet || null,
        functionName: ref.functionName || null,
        receiver: ref.receiver || null,
        language: ref.language || null,
        confidence: ref.confidence || 0,
        detectionStrategy: ref.detectionStrategy || null,
        codeUrl: ref.codeUrl || null,
        repository: ref.repository || repository,
        branch: ref.branch || branch,
        commitHash: ref.commitHash || null,
        scanId: ref.scanId || scanId,
        scanTime: ref.scanTime || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db('g_feature_code_references').insert(batch);
    }

    return references.length;
  }

  /**
   * Delete all code references for a flag
   */
  static async deleteByFlagName(flagName: string): Promise<void> {
    await db('g_feature_code_references').where('flagName', flagName).del();
  }

  /**
   * Get latest scan info
   */
  static async getLatestScanInfo(options?: { repository?: string; branch?: string }): Promise<{
    scanId: string;
    scanTime: Date;
    commitHash: string;
    totalReferences: number;
    uniqueFlags: number;
  } | null> {
    let query = db('g_feature_code_references')
      .select('scanId', 'scanTime', 'commitHash')
      .count('* as totalReferences')
      .countDistinct('flagName as uniqueFlags')
      .groupBy('scanId', 'scanTime', 'commitHash')
      .orderBy('scanTime', 'desc')
      .first();

    if (options?.repository) {
      query = query.where('repository', options.repository);
    }
    if (options?.branch) {
      query = query.where('branch', options.branch);
    }

    const result = await query;
    if (!result) return null;

    return {
      scanId: String(result.scanId),
      scanTime: new Date(result.scanTime),
      commitHash: String(result.commitHash),
      totalReferences: Number(result.totalReferences),
      uniqueFlags: Number(result.uniqueFlags),
    };
  }
}
