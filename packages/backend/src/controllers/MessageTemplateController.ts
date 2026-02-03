import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { MessageTemplateModel, MessageTemplate } from '../models/MessageTemplate';

export class MessageTemplateController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { q, limit, offset, tags } = req.query as any;

      // Handle createdBy as single value or array
      const createdBy = req.query.createdBy;
      let createdByValue: number | number[] | undefined;
      if (createdBy !== undefined) {
        if (Array.isArray(createdBy)) {
          createdByValue = createdBy.map((v) => Number(v));
        } else {
          createdByValue = Number(createdBy);
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

      // tags 파라미터 처리 (배열로 변환)
      let tagIds: string[] | undefined;
      if (tags) {
        tagIds = Array.isArray(tags) ? tags : [tags];
      }
      const tagsOperator = req.query.tags_operator as 'any_of' | 'include_all' | undefined;

      const environment = req.environment || 'development';

      // MessageTemplateModel 사용
      const result = await MessageTemplateModel.findAllWithPagination({
        environment,
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

  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const environment = req.environment || 'development';
      const data = await MessageTemplateModel.findById(id, environment);
      if (!data) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as MessageTemplate;
      const environment = req.environment || 'development';

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

      const created = await MessageTemplateModel.create(
        {
          ...body,
          created_by: (req as any)?.user?.userId,
          updated_by: (req as any)?.user?.userId,
        },
        environment
      );
      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const body = req.body as MessageTemplate;
      const environment = req.environment || 'development';

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

      const updated = await MessageTemplateModel.update(
        id,
        {
          ...body,
          created_by: (req as any)?.user?.userId,
          updated_by: (req as any)?.user?.userId,
        },
        environment
      );
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const environment = req.environment || 'development';
      await MessageTemplateModel.delete(id, environment);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  static async bulkDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;

      const environment = req.environment || 'development';

      // Delete all templates
      await Promise.all(ids.map((id: any) => MessageTemplateModel.delete(Number(id), environment)));

      res.json({
        success: true,
        message: `Successfully deleted ${ids.length} message templates`,
      });
    } catch (e) {
      next(e);
    }
  }

  // 메시지 템플릿 태그 설정
  static async setTags(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { tagIds } = req.body;

      if (!Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          message: 'tagIds must be an array',
        });
      }

      await MessageTemplateModel.setTags(parseInt(id), tagIds);

      res.json({
        success: true,
        message: 'Tags updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // 메시지 템플릿 태그 조회
  static async getTags(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tags = await MessageTemplateModel.getTags(parseInt(id));

      res.json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }
}
