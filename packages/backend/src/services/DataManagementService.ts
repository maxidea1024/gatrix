import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import db from "../config/knex";
import { cacheService } from "./CacheService";
import logger from "../config/logger";
import { GatrixError } from "../middleware/errorHandler";

const knex = db;

export class DataManagementService {
  private static readonly PLANNING_DATA_PATH = path.join(
    __dirname,
    "../../data/planning",
  );
  private static readonly UPLOADS_PATH = path.join(__dirname, "../../uploads");

  /**
   * Export all data (DB tables, Planning Data, Uploads) to a ZIP file
   */
  static async exportData(): Promise<Buffer> {
    try {
      const zip = new AdmZip();

      // 1. Export Database Tables
      const tables = await this.getAllTables();
      const dbFolder = "database";

      for (const table of tables) {
        // Skip migration tables
        if (table.includes("knex_") || table.includes("migration")) continue;

        const data = await knex(table).select("*");
        zip.addFile(
          `${dbFolder}/${table}.json`,
          Buffer.from(JSON.stringify(data, null, 2)),
        );
      }

      // 2. Export Planning Data
      if (fs.existsSync(this.PLANNING_DATA_PATH)) {
        zip.addLocalFolder(this.PLANNING_DATA_PATH, "planning_data");
      }

      // 3. Export Uploads (if exists)
      if (fs.existsSync(this.UPLOADS_PATH)) {
        zip.addLocalFolder(this.UPLOADS_PATH, "uploads");
      }

      return zip.toBuffer();
    } catch (error) {
      logger.error("Failed to export data", { error });
      throw new GatrixError("Failed to export data", 500);
    }
  }

  /**
   * Import data from a ZIP file
   * @param zipBuffer Buffer of the uploaded ZIP file
   */
  static async importData(zipBuffer: Buffer): Promise<void> {
    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      // 1. Restore Database Tables
      await knex.transaction(async (trx: any) => {
        // Disable foreign key checks
        await trx.raw("SET FOREIGN_KEY_CHECKS = 0");

        for (const entry of zipEntries) {
          if (
            entry.entryName.startsWith("database/") &&
            entry.name.endsWith(".json")
          ) {
            const tableName = entry.name.replace(".json", "");
            const data = JSON.parse(entry.getData().toString("utf8"));

            // Truncate table
            await trx(tableName).truncate();

            // Insert data in chunks to avoid query size limits
            if (data.length > 0) {
              const chunkSize = 100;
              for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await trx(tableName).insert(chunk);
              }
            }
          }
        }

        // Enable foreign key checks
        await trx.raw("SET FOREIGN_KEY_CHECKS = 1");
      });

      // 2. Restore Planning Data
      const planningEntry = zipEntries.find((e: any) =>
        e.entryName.startsWith("planning_data/"),
      );
      if (planningEntry) {
        // Clear existing planning data directory
        if (fs.existsSync(this.PLANNING_DATA_PATH)) {
          fs.rmSync(this.PLANNING_DATA_PATH, { recursive: true, force: true });
        }
        fs.mkdirSync(this.PLANNING_DATA_PATH, { recursive: true });

        // Extract planning data
        zipEntries.forEach((entry: any) => {
          if (
            entry.entryName.startsWith("planning_data/") &&
            !entry.isDirectory
          ) {
            const relativePath = entry.entryName.replace("planning_data/", "");
            const fullPath = path.join(this.PLANNING_DATA_PATH, relativePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, entry.getData());
          }
        });
      }

      // 3. Restore Uploads
      const uploadsEntry = zipEntries.find((e: any) =>
        e.entryName.startsWith("uploads/"),
      );
      if (uploadsEntry) {
        // Clear existing uploads directory
        if (fs.existsSync(this.UPLOADS_PATH)) {
          fs.rmSync(this.UPLOADS_PATH, { recursive: true, force: true });
        }
        fs.mkdirSync(this.UPLOADS_PATH, { recursive: true });

        // Extract uploads
        zipEntries.forEach((entry: any) => {
          if (entry.entryName.startsWith("uploads/") && !entry.isDirectory) {
            const relativePath = entry.entryName.replace("uploads/", "");
            const fullPath = path.join(this.UPLOADS_PATH, relativePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, entry.getData());
          }
        });
      }

      // 4. Invalidate Caches
      await cacheService.clear();

      logger.info("Data import completed successfully");
    } catch (error) {
      logger.error("Failed to import data", { error });
      throw new GatrixError("Failed to import data", 500);
    }
  }

  private static async getAllTables(): Promise<string[]> {
    const result = await knex.raw(
      "SHOW FULL TABLES WHERE Table_Type = 'BASE TABLE'",
    );
    // Result structure depends on driver. For mysql2 it's [[RowDataPacket], [FieldPacket]]
    // RowDataPacket has key like 'Tables_in_gatrix'
    const rows = result[0];
    return rows.map((row: any) => Object.values(row)[0] as string);
  }
}
