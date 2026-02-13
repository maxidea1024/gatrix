/**
 * Impact Metric Config Model
 *
 * CRUD for metric chart configurations (global or per-flag).
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../config/knex';
import logger from '../config/logger';

export interface ImpactMetricConfigAttributes {
  id: string;
  flagId?: string | null;
  title: string;
  metricName: string;
  chartType: string;
  groupBy?: string[] | null;
  labelSelectors?: Record<string, string[]> | null;
  aggregationMode: string;
  chartRange: string;
  displayOrder: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export class ImpactMetricConfigModel {
  static async findByFlag(flagId: string): Promise<ImpactMetricConfigAttributes[]> {
    try {
      const configs = await db('g_impact_metric_configs')
        .where('flagId', flagId)
        .orderBy('displayOrder', 'asc')
        .orderBy('createdAt', 'asc');

      return configs.map((c: any) => ({
        ...c,
        labelSelectors:
          typeof c.labelSelectors === 'string' ? JSON.parse(c.labelSelectors) : c.labelSelectors,
        groupBy: typeof c.groupBy === 'string' ? JSON.parse(c.groupBy) : c.groupBy,
      }));
    } catch (error) {
      logger.error('Error finding impact metric configs:', error);
      throw error;
    }
  }

  static async findAll(): Promise<ImpactMetricConfigAttributes[]> {
    try {
      const configs = await db('g_impact_metric_configs')
        .orderBy('displayOrder', 'asc')
        .orderBy('createdAt', 'asc');

      return configs.map((c: any) => ({
        ...c,
        labelSelectors:
          typeof c.labelSelectors === 'string' ? JSON.parse(c.labelSelectors) : c.labelSelectors,
        groupBy: typeof c.groupBy === 'string' ? JSON.parse(c.groupBy) : c.groupBy,
      }));
    } catch (error) {
      logger.error('Error finding all impact metric configs:', error);
      throw error;
    }
  }

  static async findById(id: string): Promise<ImpactMetricConfigAttributes | null> {
    try {
      const config = await db('g_impact_metric_configs').where('id', id).first();
      if (!config) return null;

      return {
        ...config,
        labelSelectors:
          typeof config.labelSelectors === 'string'
            ? JSON.parse(config.labelSelectors)
            : config.labelSelectors,
        groupBy: typeof config.groupBy === 'string' ? JSON.parse(config.groupBy) : config.groupBy,
      };
    } catch (error) {
      logger.error('Error finding impact metric config by ID:', error);
      throw error;
    }
  }

  static async create(
    data: Omit<ImpactMetricConfigAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImpactMetricConfigAttributes> {
    try {
      const id = uuidv4().replace(/-/g, '').substring(0, 26);

      await db('g_impact_metric_configs').insert({
        id,
        flagId: data.flagId || null,
        title: data.title,
        metricName: data.metricName,
        chartType: data.chartType || 'line',
        groupBy: data.groupBy ? JSON.stringify(data.groupBy) : null,
        labelSelectors: data.labelSelectors ? JSON.stringify(data.labelSelectors) : null,
        aggregationMode: data.aggregationMode || 'count',
        chartRange: data.chartRange || 'hour',
        displayOrder: data.displayOrder ?? 0,
        createdBy: data.createdBy || null,
      });

      return (await this.findById(id))!;
    } catch (error) {
      logger.error('Error creating impact metric config:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: Partial<Omit<ImpactMetricConfigAttributes, 'id' | 'flagId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImpactMetricConfigAttributes | null> {
    try {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.metricName !== undefined) updateData.metricName = data.metricName;
      if (data.chartType !== undefined) updateData.chartType = data.chartType;
      if (data.groupBy !== undefined) {
        updateData.groupBy = data.groupBy ? JSON.stringify(data.groupBy) : null;
      }
      if (data.labelSelectors !== undefined) {
        updateData.labelSelectors = data.labelSelectors
          ? JSON.stringify(data.labelSelectors)
          : null;
      }
      if (data.aggregationMode !== undefined) updateData.aggregationMode = data.aggregationMode;
      if (data.chartRange !== undefined) updateData.chartRange = data.chartRange;
      if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

      await db('g_impact_metric_configs').where('id', id).update(updateData);
      return this.findById(id);
    } catch (error) {
      logger.error('Error updating impact metric config:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await db('g_impact_metric_configs').where('id', id).delete();
    } catch (error) {
      logger.error('Error deleting impact metric config:', error);
      throw error;
    }
  }
}
