import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  MessageTemplateModel,
  MessageTemplate,
} from '../models/message-template';
import { TagService } from '../services/tag-service';

export class MessageTemplateController {
  static async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { q, limit, offset, tags } = req.query as any;

      // Handle createdBy as single value or array
      const createdBy = req.query.createdBy;
      let createdByValue: string[] | undefined;
      if (createdBy !== undefined) {
        if (Array.isArray(createdBy)) {
          createdByValue = createdBy.map((v) => String(v));
        } else {
          createdByValue = [String(createdBy)];
        }
      }
      const createdByOperator = req.query.createdBy_operator as
        | 'any_of'
        | 'include_all'
        | undefined;

      // Handle isEnabled as single value or array
      const isEnabled = req.query.isEnabled;
      let isEnabledValue: boolean | boolean[] | undefined;
      if (isEnabled !== undefined) {
        if (Array.isArray(isEnabled)) {
          isEnabledValue = isEnabled.map((v) => {
            const str = String(v);
            return str === '1' || str === 'true';
          });
        } else {
          const str = String(isEnabled);
          isEnabledValue = str === '1' || str === 'true';
        }
      }
      const isEnabledOperator = req.query.isEnabled_operator as
        | 'any_of'
        | 'include_all'
        | undefined;

      // Process tags parameter (convert to array)
      let tagIds: string[] | undefined;
      if (tags) {
        tagIds = Array.isArray(tags) ? tags : [tags];
      }
      const tagsOperator = req.query.tags_operator as
        | 'any_of'
        | 'include_all'
        | undefined;

      const environmentId = req.environmentId!;

      // MessageTemplateModel Used
      const result = await MessageTemplateModel.findAllWithPagination({
        environmentId,
        createdBy: createdByValue,
        createdBy_operator: createdByOperator,
        isEnabled: isEnabledValue,
        isEnabled_operator: isEnabledOperator,
        search: q,
        tags: tagIds,
        tags_operator: tagsOperator,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
      });
      const data = { items: result.messageTemplates, total: result.total };
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  static async get(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = req.params.id;
      const environmentId = req.environmentId!;
      const data = await MessageTemplateModel.findById(id, environmentId);
      if (!data)
        return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  static async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const body = req.body as MessageTemplate;
      const environmentId = req.environmentId!;

      // Check for duplicate name
      const existing = await MessageTemplateModel.findByName(body.name);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'A message template with this name already exists',
            code: 'DUPLICATE_NAME',
            field: 'name',
            value: body.name,
          },
        });
      }

      const { tags, ...templateData } = body as any;
      const created = await MessageTemplateModel.create(
        {
          ...templateData,
          created_by: (req as any)?.user?.userId,
          updated_by: (req as any)?.user?.userId,
        },
        environmentId
      );

      // Handle tags if provided
      if (tags && Array.isArray(tags) && created?.id) {
        const tagIds = tags.map((tag: any) => tag.id).filter((tid: any) => tid);
        await TagService.setTagsForEntity(
          'message_template',
          created.id.toString(),
          tagIds,
          (req as any)?.user?.userId
        );
      }

      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }

  static async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = req.params.id;
      const body = req.body as MessageTemplate;
      const environmentId = req.environmentId!;

      // Check for duplicate name (excluding current template)
      const existing = await MessageTemplateModel.findByName(body.name, id);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'A message template with this name already exists',
            code: 'DUPLICATE_NAME',
            field: 'name',
            value: body.name,
          },
        });
      }

      const { tags, ...templateData } = body as any;
      const updated = await MessageTemplateModel.update(
        id,
        {
          ...templateData,
          created_by: (req as any)?.user?.userId,
          updated_by: (req as any)?.user?.userId,
        },
        environmentId
      );

      // Handle tags if provided
      if (tags !== undefined) {
        const tagIds = Array.isArray(tags)
          ? tags.map((tag: any) => tag.id).filter((tid: any) => tid)
          : [];
        await TagService.setTagsForEntity(
          'message_template',
          id,
          tagIds,
          (req as any)?.user?.userId
        );
      }

      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  static async remove(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = req.params.id;
      const environmentId = req.environmentId!;
      await MessageTemplateModel.delete(id, environmentId);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  static async bulkDelete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { ids } = req.body;

      const environmentId = req.environmentId!;

      // Delete all templates
      await Promise.all(
        ids.map((id: any) => MessageTemplateModel.delete(id, environmentId))
      );

      res.json({
        success: true,
        message: `Successfully deleted ${ids.length} message templates`,
      });
    } catch (e) {
      next(e);
    }
  }
}
