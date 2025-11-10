/**
 * Service Maintenance Model
 * 
 * Manages maintenance status for service types in Service Discovery
 */

import db from '../config/knex';
import logger from '../config/logger';
import { convertDateFieldsForMySQL, convertDateFieldsFromMySQL } from '../utils/dateUtils';

export interface ServiceMaintenanceLocale {
  id?: number;
  serviceMaintenanceId: number;
  lang: 'ko' | 'en' | 'zh';
  message: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ServiceMaintenance {
  id: number;
  serviceType: string;
  isInMaintenance: boolean;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ServiceMaintenanceLocale[];
  createdBy?: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceMaintenanceData {
  serviceType: string;
  isInMaintenance: boolean;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: Omit<ServiceMaintenanceLocale, 'id' | 'serviceMaintenanceId' | 'createdAt' | 'updatedAt'>[];
  createdBy?: number;
}

export interface UpdateServiceMaintenanceData {
  isInMaintenance?: boolean;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: Omit<ServiceMaintenanceLocale, 'id' | 'serviceMaintenanceId' | 'createdAt' | 'updatedAt'>[];
  updatedBy?: number;
}

class ServiceMaintenanceModel {
  /**
   * Get maintenance info by service type
   */
  static async getByServiceType(serviceType: string): Promise<ServiceMaintenance | null> {
    try {
      const record = await db('g_service_maintenance')
        .where('serviceType', serviceType)
        .first();

      if (!record) {
        return null;
      }

      // Get locales
      const locales = await db('g_service_maintenance_locales')
        .where('serviceMaintenanceId', record.id)
        .select('lang', 'message');

      const converted = convertDateFieldsFromMySQL(record, ['maintenanceStartDate', 'maintenanceEndDate', 'createdAt', 'updatedAt']);

      return {
        ...converted,
        maintenanceLocales: locales || []
      };
    } catch (error) {
      logger.error(`Error getting service maintenance for ${serviceType}:`, error);
      throw error;
    }
  }

  /**
   * Check if service is in maintenance
   */
  static async isInMaintenance(serviceType: string): Promise<boolean> {
    try {
      const record = await db('g_service_maintenance')
        .where('serviceType', serviceType)
        .where('isInMaintenance', true)
        .first();

      if (!record) {
        return false;
      }

      // Check time-based maintenance
      const now = new Date();
      if (record.maintenanceStartDate && new Date(record.maintenanceStartDate) > now) {
        return false; // Not started yet
      }
      if (record.maintenanceEndDate && new Date(record.maintenanceEndDate) < now) {
        return false; // Already ended
      }

      return true;
    } catch (error) {
      logger.error(`Error checking maintenance status for ${serviceType}:`, error);
      return false;
    }
  }

  /**
   * Get maintenance message for service type
   */
  static async getMaintenanceMessage(serviceType: string, lang?: 'ko' | 'en' | 'zh'): Promise<string | null> {
    try {
      const maintenance = await this.getByServiceType(serviceType);

      if (!maintenance || !maintenance.isInMaintenance) {
        return null;
      }

      // Check time-based maintenance
      const now = new Date();
      if (maintenance.maintenanceStartDate && new Date(maintenance.maintenanceStartDate) > now) {
        return null; // Not started yet
      }
      if (maintenance.maintenanceEndDate && new Date(maintenance.maintenanceEndDate) < now) {
        return null; // Already ended
      }

      // Try to get localized message
      if (maintenance.supportsMultiLanguage && maintenance.maintenanceLocales && lang) {
        const locale = maintenance.maintenanceLocales.find(l => l.lang === lang);
        if (locale) {
          return locale.message;
        }
        // Fallback to first available locale
        if (maintenance.maintenanceLocales.length > 0) {
          return maintenance.maintenanceLocales[0].message;
        }
      }

      return maintenance.maintenanceMessage || null;
    } catch (error) {
      logger.error(`Error getting maintenance message for ${serviceType}:`, error);
      return null;
    }
  }

  /**
   * Create or update service maintenance
   */
  static async upsert(data: CreateServiceMaintenanceData): Promise<ServiceMaintenance> {
    try {
      return await db.transaction(async (trx) => {
        const { maintenanceLocales, ...mainData } = data;

        // Convert dates to MySQL format
        const convertedData = convertDateFieldsForMySQL(mainData, ['maintenanceStartDate', 'maintenanceEndDate']);

        // Check if record exists
        const existing = await trx('g_service_maintenance')
          .where('serviceType', data.serviceType)
          .first();

        let id: number;

        if (existing) {
          // Update existing record
          await trx('g_service_maintenance')
            .where('serviceType', data.serviceType)
            .update({
              ...convertedData,
              updatedBy: data.createdBy,
              updatedAt: new Date()
            });
          id = existing.id;

          // Delete existing locales
          await trx('g_service_maintenance_locales')
            .where('serviceMaintenanceId', id)
            .delete();
        } else {
          // Insert new record
          const [insertId] = await trx('g_service_maintenance').insert(convertedData);
          id = insertId;
        }

        // Insert locales if provided
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          const localeInserts = maintenanceLocales.map(locale => ({
            serviceMaintenanceId: id,
            lang: locale.lang,
            message: locale.message,
            createdBy: data.createdBy,
            updatedBy: data.createdBy
          }));

          await trx('g_service_maintenance_locales').insert(localeInserts);
        }

        // Fetch and return the created/updated record
        const record = await trx('g_service_maintenance')
          .where('id', id)
          .first();

        const locales = await trx('g_service_maintenance_locales')
          .where('serviceMaintenanceId', id)
          .select('lang', 'message');

        const converted = convertDateFieldsFromMySQL(record, ['maintenanceStartDate', 'maintenanceEndDate', 'createdAt', 'updatedAt']);

        return {
          ...converted,
          maintenanceLocales: locales || []
        };
      });
    } catch (error) {
      logger.error('Error upserting service maintenance:', error);
      throw error;
    }
  }

  /**
   * List all service maintenance records
   */
  static async list(): Promise<ServiceMaintenance[]> {
    try {
      const records = await db('g_service_maintenance')
        .select('*')
        .orderBy('serviceType', 'asc');

      // Get locales for each record
      const recordsWithLocales = await Promise.all(
        records.map(async (record: any) => {
          const locales = await db('g_service_maintenance_locales')
            .where('serviceMaintenanceId', record.id)
            .select('lang', 'message');

          const converted = convertDateFieldsFromMySQL(record, ['maintenanceStartDate', 'maintenanceEndDate', 'createdAt', 'updatedAt']);

          return {
            ...converted,
            maintenanceLocales: locales || []
          };
        })
      );

      return recordsWithLocales;
    } catch (error) {
      logger.error('Error listing service maintenance:', error);
      throw error;
    }
  }

  /**
   * Delete service maintenance record
   */
  static async delete(serviceType: string): Promise<void> {
    try {
      await db('g_service_maintenance')
        .where('serviceType', serviceType)
        .delete();
    } catch (error) {
      logger.error(`Error deleting service maintenance for ${serviceType}:`, error);
      throw error;
    }
  }
}

export default ServiceMaintenanceModel;

