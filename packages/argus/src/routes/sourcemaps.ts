import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('sourcemaps-api');

// Directory to store uploaded source maps
const SOURCEMAP_DIR = process.env.ARGUS_SOURCEMAP_DIR || path.join(process.cwd(), 'data', 'sourcemaps');

export default async function sourcemapsRoutes(app: FastifyInstance) {
  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max per file
      files: 100,
    },
  });

  // List source map releases for a project
  app.get(
    '/:projectId/sourcemaps',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_sourcemap_releases
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT 50`,
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list sourcemap releases', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list sourcemap releases' });
      }
    }
  );

  // Upload source map files for a release
  app.post(
    '/:projectId/sourcemaps',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const parts = request.parts();
        let release = '';
        let dist = '';
        const files: { filePath: string; data: Buffer }[] = [];

        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'release') release = String(part.value);
            if (part.fieldname === 'dist') dist = String(part.value);
          } else if (part.type === 'file') {
            const buf = await part.toBuffer();
            files.push({
              filePath: part.filename || part.fieldname,
              data: buf,
            });
          }
        }

        if (!release) {
          return reply.code(400).send({ error: 'release is required' });
        }

        if (files.length === 0) {
          return reply.code(400).send({ error: 'No files uploaded' });
        }

        // Upsert release record
        const [existing] = await mysqlPool.query(
          `SELECT id FROM g_argus_sourcemap_releases
           WHERE project_id = ? AND release = ? AND dist = ?`,
          [projectId, release, dist]
        );
        const existingRows = existing as any[];
        let releaseId: number;

        if (existingRows.length > 0) {
          releaseId = existingRows[0].id;
          // Delete old files for this release
          await mysqlPool.query(
            `DELETE FROM g_argus_sourcemap_files WHERE release_id = ?`,
            [releaseId]
          );
        } else {
          const [insertResult] = await mysqlPool.query(
            `INSERT INTO g_argus_sourcemap_releases (project_id, release, dist, file_count)
             VALUES (?, ?, ?, ?)`,
            [projectId, release, dist, files.length]
          );
          releaseId = (insertResult as any).insertId;
        }

        // Save files to disk and create DB entries
        const releaseDir = path.join(SOURCEMAP_DIR, String(projectId), String(releaseId));
        await fs.mkdir(releaseDir, { recursive: true });

        for (const file of files) {
          const safeName = file.filePath.replace(/[^a-zA-Z0-9._\-/]/g, '_');
          const diskPath = path.join(releaseDir, safeName);
          const diskDir = path.dirname(diskPath);
          await fs.mkdir(diskDir, { recursive: true });
          await fs.writeFile(diskPath, file.data);

          await mysqlPool.query(
            `INSERT INTO g_argus_sourcemap_files
             (release_id, project_id, file_path, file_name, sourcemap_path, file_size)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              releaseId,
              projectId,
              file.filePath,
              path.basename(file.filePath),
              diskPath,
              file.data.length,
            ]
          );
        }

        // Update file count
        await mysqlPool.query(
          `UPDATE g_argus_sourcemap_releases SET file_count = ? WHERE id = ?`,
          [files.length, releaseId]
        );

        logger.info('Sourcemaps uploaded', {
          projectId,
          release,
          dist,
          fileCount: files.length,
        });

        return reply.send({
          success: true,
          data: {
            release_id: releaseId,
            file_count: files.length,
          },
        });
      } catch (error) {
        logger.error('Failed to upload sourcemaps', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to upload sourcemaps' });
      }
    }
  );

  // Delete a source map release
  app.delete(
    '/:projectId/sourcemaps/:releaseId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, releaseId } = request.params as { projectId: string; releaseId: string };

      try {
        // Delete files from disk
        const releaseDir = path.join(SOURCEMAP_DIR, String(projectId), String(releaseId));
        try {
          await fs.rm(releaseDir, { recursive: true, force: true });
        } catch { /* ignore if dir doesn't exist */ }

        // Delete from DB (cascade deletes files)
        await mysqlPool.query(
          `DELETE FROM g_argus_sourcemap_releases WHERE id = ? AND project_id = ?`,
          [releaseId, projectId]
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete sourcemap release', {
          projectId,
          releaseId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete sourcemap release' });
      }
    }
  );

  // Get files for a release
  app.get(
    '/:projectId/sourcemaps/:releaseId/files',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, releaseId } = request.params as { projectId: string; releaseId: string };

      try {
        const [rows] = await mysqlPool.query(
          `SELECT id, file_path, file_name, file_size, created_at
           FROM g_argus_sourcemap_files
           WHERE release_id = ? AND project_id = ?`,
          [releaseId, projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list sourcemap files', {
          projectId,
          releaseId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list sourcemap files' });
      }
    }
  );
}
