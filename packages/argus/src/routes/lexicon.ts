import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const logger = createLogger('lexicon-api');

// ── Reserved (System) Events & Properties ──
const DEFAULT_RESERVED_EVENTS = [
  {
    event_name: '$session_start',
    display_name: 'Session Start',
    icon: 'CheckCircle',
    icon_color: '#22c55e',
    description: 'Triggers when a user session begins.',
    is_reserved: true,
    status: 'active',
    category: 'Session',
  },
  {
    event_name: '$session_end',
    display_name: 'Session End',
    icon: 'XCircle',
    icon_color: '#ef4444',
    description: 'Triggers when a user session ends.',
    is_reserved: true,
    status: 'active',
    category: 'Session',
  },
  {
    event_name: '$page_view',
    display_name: 'Page View',
    icon: 'FileText',
    icon_color: '#3b82f6',
    description: 'Triggers when a page or screen is viewed.',
    is_reserved: true,
    status: 'active',
    category: 'Navigation',
  },
  {
    event_name: '$click',
    display_name: 'Click',
    icon: 'CursorClick',
    icon_color: '#f59e0b',
    description: 'Triggers on user click interactions.',
    is_reserved: true,
    status: 'active',
    category: 'Interaction',
  },
  {
    event_name: '$error',
    display_name: 'Error Captured',
    icon: 'Bug',
    icon_color: '#ef4444',
    description: 'Triggers when an application exception is captured.',
    is_reserved: true,
    status: 'active',
    category: 'Error',
  },
  {
    event_name: '$feedback',
    display_name: 'User Feedback',
    icon: 'ChatCircle',
    icon_color: '#8b5cf6',
    description: 'Triggers when a user submits a feedback form.',
    is_reserved: true,
    status: 'active',
    category: 'Feedback',
  },
];

const DEFAULT_RESERVED_PROPERTIES = [
  {
    property_name: '$browser',
    display_name: 'Browser',
    description: 'Web browser used',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
  {
    property_name: '$os',
    display_name: 'OS',
    description: 'Operating system used',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
  {
    property_name: '$country',
    display_name: 'Country',
    description: 'User country',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
  {
    property_name: '$city',
    display_name: 'City',
    description: 'User city',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
  {
    property_name: '$device_id',
    display_name: 'Device ID',
    description: 'Unique device identifier',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
  {
    property_name: '$app_version',
    display_name: 'App Version',
    description: 'Version of the app',
    data_type: 'string',
    is_reserved: true,
    status: 'active',
  },
];

export default async function lexiconRoutes(app: FastifyInstance) {
  // ── Seed reserved events & properties for existing projects ──
  app.post(
    '/projects/:projectId/lexicon/seed',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      try {
        const eventsToInsert = DEFAULT_RESERVED_EVENTS.map((ev) => ({
          project_id: projectId,
          ...ev,
        }));
        await db('g_argus_lexicon_events')
          .insert(eventsToInsert)
          .onConflict(['project_id', 'event_name'])
          .ignore();

        const propertiesToInsert = DEFAULT_RESERVED_PROPERTIES.map((prop) => ({
          project_id: projectId,
          ...prop,
        }));
        await db('g_argus_lexicon_properties')
          .insert(propertiesToInsert)
          .onConflict(['project_id', 'property_name'])
          .ignore();

        logger.info('Lexicon seeded', { projectId });
        return reply.send({
          success: true,
          message: 'Reserved events and properties seeded',
        });
      } catch (error) {
        logger.error('Failed to seed lexicon', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ success: false, message: 'Failed to seed lexicon' });
      }
    }
  );

  // ── List lexicon events ──
  app.get(
    '/projects/:projectId/lexicon/events',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      try {
        const rows = await db('g_argus_lexicon_events')
          .where('project_id', projectId)
          .orderBy('is_reserved', 'desc')
          .orderBy('event_name', 'asc');
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to list lexicon events', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ success: false, message: 'Failed to list lexicon events' });
      }
    }
  );

  // ── Create event ──
  app.post(
    '/projects/:projectId/lexicon/events',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: {
          event_name: string;
          display_name?: string;
          icon?: string;
          icon_color?: string;
          description?: string;
          category?: string;
          status?: 'active' | 'deprecated' | 'hidden';
          owner?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.event_name || !body.event_name.trim()) {
        return reply
          .code(400)
          .send({ success: false, message: 'event_name is required' });
      }

      try {
        await db('g_argus_lexicon_events').insert({
          project_id: projectId,
          event_name: body.event_name.trim(),
          display_name: body.display_name || null,
          icon: body.icon || null,
          icon_color: body.icon_color || null,
          description: body.description || null,
          category: body.category || null,
          status: body.status || 'active',
          owner: body.owner || null,
          is_reserved: false,
        });

        logger.info('Lexicon event created', {
          projectId,
          eventName: body.event_name,
        });
        return reply.code(201).send({ success: true });
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          return reply
            .code(409)
            .send({
              success: false,
              message: 'Event already exists in lexicon',
            });
        }
        logger.error('Failed to create lexicon event', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ success: false, message: 'Failed to create lexicon event' });
      }
    }
  );

  // ── Update event metadata ──
  app.patch(
    '/projects/:projectId/lexicon/events/:eventName',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; eventName: string };
        Body: {
          display_name?: string;
          icon?: string;
          icon_color?: string;
          description?: string;
          category?: string;
          status?: 'active' | 'deprecated' | 'hidden';
          owner?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, eventName } = request.params;
      const body = request.body;

      try {
        const existing = await db('g_argus_lexicon_events')
          .where({ project_id: projectId, event_name: eventName })
          .first();

        if (!existing) {
          return reply
            .code(404)
            .send({ success: false, message: 'Event not found in lexicon' });
        }

        const updateData: any = {};
        if (body.display_name !== undefined)
          updateData.display_name = body.display_name;
        if (body.icon !== undefined) updateData.icon = body.icon;
        if (body.icon_color !== undefined)
          updateData.icon_color = body.icon_color;
        if (body.description !== undefined)
          updateData.description = body.description;
        if (body.category !== undefined) updateData.category = body.category;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.owner !== undefined) updateData.owner = body.owner;

        await db('g_argus_lexicon_events')
          .where({ project_id: projectId, event_name: eventName })
          .update(updateData);

        logger.info('Lexicon event updated', { projectId, eventName });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update lexicon event', {
          projectId,
          eventName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ success: false, message: 'Failed to update lexicon event' });
      }
    }
  );

  // ── Delete event (custom only) ──
  app.delete(
    '/projects/:projectId/lexicon/events/:eventName',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; eventName: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, eventName } = request.params;
      try {
        const existing = await db('g_argus_lexicon_events')
          .where({ project_id: projectId, event_name: eventName })
          .first();

        if (!existing) {
          return reply
            .code(404)
            .send({ success: false, message: 'Event not found' });
        }
        if (existing.is_reserved) {
          return reply
            .code(403)
            .send({
              success: false,
              message: 'Cannot delete reserved system events',
            });
        }

        await db('g_argus_lexicon_events')
          .where({ project_id: projectId, event_name: eventName })
          .delete();

        logger.info('Lexicon event deleted', { projectId, eventName });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete lexicon event', {
          projectId,
          eventName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ success: false, message: 'Failed to delete lexicon event' });
      }
    }
  );

  // ── List lexicon properties ──
  app.get(
    '/projects/:projectId/lexicon/properties',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      try {
        const rows = await db('g_argus_lexicon_properties')
          .where('project_id', projectId)
          .orderBy('is_reserved', 'desc')
          .orderBy('property_name', 'asc');
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to list lexicon properties', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({
            success: false,
            message: 'Failed to list lexicon properties',
          });
      }
    }
  );

  // ── Create property ──
  app.post(
    '/projects/:projectId/lexicon/properties',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: {
          property_name: string;
          display_name?: string;
          description?: string;
          data_type?: 'string' | 'number' | 'boolean' | 'date';
          status?: 'active' | 'deprecated' | 'hidden';
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.property_name || !body.property_name.trim()) {
        return reply
          .code(400)
          .send({ success: false, message: 'property_name is required' });
      }

      try {
        await db('g_argus_lexicon_properties').insert({
          project_id: projectId,
          property_name: body.property_name.trim(),
          display_name: body.display_name || null,
          description: body.description || null,
          data_type: body.data_type || 'string',
          status: body.status || 'active',
          is_reserved: false,
        });

        logger.info('Lexicon property created', {
          projectId,
          propertyName: body.property_name,
        });
        return reply.code(201).send({ success: true });
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          return reply
            .code(409)
            .send({
              success: false,
              message: 'Property already exists in lexicon',
            });
        }
        logger.error('Failed to create lexicon property', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({
            success: false,
            message: 'Failed to create lexicon property',
          });
      }
    }
  );

  // ── Update property metadata ──
  app.patch(
    '/projects/:projectId/lexicon/properties/:propertyName',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; propertyName: string };
        Body: {
          display_name?: string;
          description?: string;
          data_type?: 'string' | 'number' | 'boolean' | 'date';
          status?: 'active' | 'deprecated' | 'hidden';
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, propertyName } = request.params;
      const body = request.body;

      try {
        const existing = await db('g_argus_lexicon_properties')
          .where({ project_id: projectId, property_name: propertyName })
          .first();

        if (!existing) {
          return reply
            .code(404)
            .send({ success: false, message: 'Property not found in lexicon' });
        }

        const updateData: any = {};
        if (body.display_name !== undefined)
          updateData.display_name = body.display_name;
        if (body.description !== undefined)
          updateData.description = body.description;
        if (body.data_type !== undefined) updateData.data_type = body.data_type;
        if (body.status !== undefined) updateData.status = body.status;

        await db('g_argus_lexicon_properties')
          .where({ project_id: projectId, property_name: propertyName })
          .update(updateData);

        logger.info('Lexicon property updated', { projectId, propertyName });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update lexicon property', {
          projectId,
          propertyName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({
            success: false,
            message: 'Failed to update lexicon property',
          });
      }
    }
  );

  // ── Delete property (custom only) ──
  app.delete(
    '/projects/:projectId/lexicon/properties/:propertyName',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; propertyName: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, propertyName } = request.params;
      try {
        const existing = await db('g_argus_lexicon_properties')
          .where({ project_id: projectId, property_name: propertyName })
          .first();

        if (!existing) {
          return reply
            .code(404)
            .send({ success: false, message: 'Property not found' });
        }
        if (existing.is_reserved) {
          return reply
            .code(403)
            .send({
              success: false,
              message: 'Cannot delete reserved system properties',
            });
        }

        await db('g_argus_lexicon_properties')
          .where({ project_id: projectId, property_name: propertyName })
          .delete();

        logger.info('Lexicon property deleted', { projectId, propertyName });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete lexicon property', {
          projectId,
          propertyName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({
            success: false,
            message: 'Failed to delete lexicon property',
          });
      }
    }
  );
}
