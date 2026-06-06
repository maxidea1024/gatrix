import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import db from '../config/knex';
import { createLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('sourcemaps-api');

// Directory to store uploaded source maps
const SOURCEMAP_DIR = process.env.ARGUS_SOURCEMAP_DIR || path.join(process.cwd(), 'data', 'sourcemaps');

export default async function sourcemapsRoutes(app: FastifyInstance) {
  // Register multipart for file uploads (skip if already registered)
  try {
    await app.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max per file
        files: 100,
      },
    });
  } catch (e: any) {
    // Already registered — ignore
    if (!e.message?.includes('already registered')) {
      logger.warn('Multipart registration warning', { error: e.message });
    }
  }

  // List source map releases for a project
  app.get(
    '/:projectId/sourcemaps',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const rows = await db('g_argus_sourcemap_releases')
          .where('project_id', projectId)
          .orderBy('created_at', 'desc')
          .limit(50);
        return reply.send({ data: rows });
      } catch (error: any) {
        // If table doesn't exist yet, return empty
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          return reply.send({ data: [] });
        }
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
        const filePaths: string[] = [];
        const files: { filePath: string; data: Buffer }[] = [];

        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'release') release = String(part.value);
            if (part.fieldname === 'dist') dist = String(part.value);
            if (part.fieldname === 'file_path') filePaths.push(String(part.value));
          } else if (part.type === 'file') {
            const buf = await part.toBuffer();
            files.push({
              // Will be overridden with file_path if available
              filePath: part.filename || part.fieldname,
              data: buf,
            });
          }
        }

        // Apply file_path fields (sent before each file by argus-cli)
        for (let i = 0; i < files.length && i < filePaths.length; i++) {
          files[i].filePath = filePaths[i];
        }

        if (!release) {
          return reply.code(400).send({ error: 'release is required' });
        }

        if (files.length === 0) {
          return reply.code(400).send({ error: 'No files uploaded' });
        }

        // Upsert release record
        const existingRows = await db('g_argus_sourcemap_releases')
          .select('id')
          .where({ project_id: projectId, release, dist });
        let releaseId: number;

        if (existingRows.length > 0) {
          releaseId = existingRows[0].id;
          // Delete old files for this release
          await db('g_argus_sourcemap_files').where('release_id', releaseId).del();
        } else {
          const [insertedId] = await db('g_argus_sourcemap_releases').insert({
            project_id: projectId,
            release,
            dist,
            file_count: files.length,
          });
          releaseId = insertedId;
        }

        // Save files to disk and create DB entries
        const releaseDir = path.join(SOURCEMAP_DIR, String(projectId), String(releaseId));
        await fs.mkdir(releaseDir, { recursive: true });

        // Save files to disk and collect DB entries
        const dbRows: any[][] = [];
        for (const file of files) {
          const safeName = file.filePath.replace(/[^a-zA-Z0-9._\-/]/g, '_');
          const diskPath = path.join(releaseDir, safeName);
          const diskDir = path.dirname(diskPath);
          await fs.mkdir(diskDir, { recursive: true });
          await fs.writeFile(diskPath, file.data);

          dbRows.push([
            releaseId,
            projectId,
            file.filePath,
            path.basename(file.filePath),
            diskPath,
            file.data.length,
          ]);
        }

        // Single bulk INSERT for all sourcemap file records
        if (dbRows.length > 0) {
          await db('g_argus_sourcemap_files').insert(
            dbRows.map(([release_id, project_id, file_path, file_name, sourcemap_path, file_size]) => ({
              release_id, project_id, file_path, file_name, sourcemap_path, file_size,
            }))
          );
        }

        // Update file count
        await db('g_argus_sourcemap_releases').where('id', releaseId).update({ file_count: files.length });

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
        return reply.code(500).send({
          error: 'Failed to upload sourcemaps',
          detail: error instanceof Error ? error.message : String(error),
        });
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
        await db('g_argus_sourcemap_releases').where({ id: releaseId, project_id: projectId }).del();

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
        const rows = await db('g_argus_sourcemap_files')
          .select('id', 'file_path', 'file_name', 'file_size', 'created_at')
          .where({ release_id: releaseId, project_id: projectId });
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

  // Lookup a source map file by release + path (used by Symbolicator)
  // GET /:projectId/sourcemaps/lookup?release=1.0.0&dist=&file_path=~/static/js/main.js.map
  app.get(
    '/:projectId/sourcemaps/lookup',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { release, dist, file_path } = request.query as {
        release?: string;
        dist?: string;
        file_path?: string;
      };

      if (!release || !file_path) {
        return reply.code(400).send({ error: 'release and file_path are required' });
      }

      try {
        // Find the release
        const releases = await db('g_argus_sourcemap_releases')
          .select('id')
          .where({ project_id: projectId, release, dist: dist || '' })
          .orderBy('created_at', 'desc')
          .limit(1);

        if (releases.length === 0) {
          return reply.code(404).send({ error: 'Release not found' });
        }

        const releaseId = releases[0].id;

        // Find the file by path (exact match or suffix match)
        let files = await db('g_argus_sourcemap_files')
          .select('sourcemap_path', 'file_path')
          .where({ release_id: releaseId, project_id: projectId, file_path });

        // If no exact match, try suffix match (strip ~/ prefix)
        if (files.length === 0) {
          const stripped = file_path.replace(/^~\//, '');
          files = await db('g_argus_sourcemap_files')
            .select('sourcemap_path', 'file_path')
            .where({ release_id: releaseId, project_id: projectId })
            .andWhere('file_path', 'like', `%${stripped}`);
        }

        if (files.length === 0) {
          return reply.code(404).send({ error: 'File not found' });
        }

        const diskPath = files[0].sourcemap_path;

        try {
          await fs.access(diskPath);
        } catch {
          return reply.code(404).send({ error: 'File not found on disk' });
        }

        const fileBuffer = await fs.readFile(diskPath);
        return reply
          .header('Content-Type', 'application/octet-stream')
          .header('Content-Disposition', `attachment; filename="${path.basename(diskPath)}"`)
          .send(fileBuffer);
      } catch (error) {
        logger.error('Sourcemap lookup failed', {
          projectId,
          release,
          file_path,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Sourcemap lookup failed' });
      }
    }
  );
}
