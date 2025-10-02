import { FastifyPluginAsync } from 'fastify';
import FilterBuilder from '../services/filter-builder';
import { authenticateClient, requireReadAccess } from '../middleware/auth';

const filterBuilder = new FilterBuilder();

const filtersRoutes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트에 인증 적용
  fastify.addHook('onRequest', authenticateClient);
  fastify.addHook('onRequest', requireReadAccess);

  /**
   * GET /filters/:projectId/property-keys
   * 프로젝트의 모든 properties 키 목록 조회
   */
  fastify.get<{
    Params: { projectId: string };
    Querystring: { eventName?: string };
  }>('/:projectId/property-keys', async (request, reply) => {
    const { projectId } = request.params;
    const { eventName } = request.query;

    try {
      const keys = await filterBuilder.getPropertyKeys(projectId, eventName);

      return reply.send({
        success: true,
        data: keys,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /filters/:projectId/property-values
   * 특정 property 키의 고유 값 목록 조회
   */
  fastify.get<{
    Params: { projectId: string };
    Querystring: { propertyKey: string; eventName?: string; limit?: number };
  }>('/:projectId/property-values', async (request, reply) => {
    const { projectId } = request.params;
    const { propertyKey, eventName, limit } = request.query;

    if (!propertyKey) {
      return reply.status(400).send({
        success: false,
        error: 'propertyKey is required',
      });
    }

    try {
      const values = await filterBuilder.getPropertyValues(
        projectId,
        propertyKey,
        eventName,
        limit
      );

      return reply.send({
        success: true,
        data: values,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /filters/:projectId/event-names
   * 프로젝트의 모든 이벤트 이름 목록 조회
   */
  fastify.get<{
    Params: { projectId: string };
  }>('/:projectId/event-names', async (request, reply) => {
    const { projectId } = request.params;

    try {
      const eventNames = await filterBuilder.getEventNames(projectId);

      return reply.send({
        success: true,
        data: eventNames,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /filters/:projectId/paths
   * 프로젝트의 모든 경로 목록 조회
   */
  fastify.get<{
    Params: { projectId: string };
    Querystring: { limit?: number };
  }>('/:projectId/paths', async (request, reply) => {
    const { projectId } = request.params;
    const { limit } = request.query;

    try {
      const paths = await filterBuilder.getPaths(projectId, limit);

      return reply.send({
        success: true,
        data: paths,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /filters/:projectId/countries
   * 프로젝트의 모든 국가 목록 조회
   */
  fastify.get<{
    Params: { projectId: string };
  }>('/:projectId/countries', async (request, reply) => {
    const { projectId } = request.params;

    try {
      const countries = await filterBuilder.getCountries(projectId);

      return reply.send({
        success: true,
        data: countries,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default filtersRoutes;

