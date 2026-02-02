import { Request, Response } from "express";
import { CONTEXT_FIELDS, CONTEXT_OPERATORS } from "../types/contextFields";
import logger from "../config/logger";
import { ContextFieldModel } from "../models/ContextField";

export class ContextFieldController {
  /**
   * Get all available context fields
   */
  static async getContextFields(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const type = req.query.type as string;
      const isActive =
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
            ? false
            : undefined;

      // Get fields from database only (no more mock data)
      const { fields, total } = await ContextFieldModel.findAll({
        page,
        limit,
        search,
        type,
        isActive,
      });

      res.json({
        success: true,
        data: {
          fields: fields,
          operators: CONTEXT_OPERATORS,
          pagination: {
            page,
            limit,
            total: total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Error getting context fields:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get context fields",
      });
    }
  }

  /**
   * Get context field by key
   */
  static async getContextField(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      const field = CONTEXT_FIELDS.find((f) => f.key === key);
      if (!field) {
        res.status(404).json({
          success: false,
          message: "Context field not found",
        });
        return;
      }

      res.json({
        success: true,
        data: field,
      });
    } catch (error) {
      logger.error("Error getting context field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get context field",
      });
    }
  }

  /**
   * Get operators for a specific field type
   */
  static async getOperatorsForFieldType(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { fieldType } = req.params;

      const operators = CONTEXT_OPERATORS.filter((op) =>
        op.supportedFieldTypes.includes(fieldType as any),
      );

      res.json({
        success: true,
        data: operators,
      });
    } catch (error) {
      logger.error("Error getting operators for field type:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get operators",
      });
    }
  }

  /**
   * Get all operators
   */
  static async getAllOperators(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: CONTEXT_OPERATORS,
      });
    } catch (error) {
      logger.error("Error getting all operators:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get operators",
      });
    }
  }

  /**
   * Create context field
   */
  static async createContextField(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id || 1;
      const {
        key,
        name,
        description,
        type,
        defaultValue,
        isRequired,
        options,
      } = req.body;

      // Validate key format
      if (!ContextFieldModel.validateKey(key)) {
        res.status(400).json({
          success: false,
          message:
            "Invalid key format. Key must start with a letter and contain only letters, numbers, and underscores.",
        });
        return;
      }

      // Check if key already exists
      const existing = await ContextFieldModel.findByKey(key);
      if (existing) {
        res.status(409).json({
          success: false,
          message: "Context field with this key already exists",
        });
        return;
      }

      // Validate options for array type
      if (
        type === "array" &&
        options &&
        !ContextFieldModel.validateOptions(type, options)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid options format for array type",
        });
        return;
      }

      const createData = {
        key,
        name,
        description,
        type,
        defaultValue,
        validation: isRequired ? { required: true } : undefined,
        options,
        createdBy: userId,
      };

      const created = await ContextFieldModel.create(createData);

      res.status(201).json({
        success: true,
        data: created,
        message: "Context field created successfully",
      });
    } catch (error) {
      logger.error("Error creating context field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create context field",
      });
    }
  }

  /**
   * Update context field
   */
  static async updateContextField(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const fieldId = parseInt(req.params.id);
      const { name, description, defaultValue, isRequired, options } = req.body;

      // Check if field exists
      const existing = await ContextFieldModel.findById(fieldId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: "Context field not found",
        });
        return;
      }

      // Prevent updating system fields
      if (existing.isSystem) {
        res.status(403).json({
          success: false,
          message: "Cannot update system context fields",
        });
        return;
      }

      // Validate options for array type
      if (
        existing.type === "array" &&
        options &&
        !ContextFieldModel.validateOptions(existing.type, options)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid options format for array type",
        });
        return;
      }

      const updateData = {
        name,
        description,
        defaultValue,
        validation: isRequired ? { required: true } : undefined,
        options,
        updatedBy: userId,
      };

      const updated = await ContextFieldModel.update(fieldId, updateData);

      res.json({
        success: true,
        data: updated,
        message: "Context field updated successfully",
      });
    } catch (error) {
      logger.error("Error updating context field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update context field",
      });
    }
  }

  /**
   * Delete context field
   */
  static async deleteContextField(req: Request, res: Response): Promise<void> {
    try {
      const fieldId = parseInt(req.params.id);

      // Check if field exists
      const existing = await ContextFieldModel.findById(fieldId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: "Context field not found",
        });
        return;
      }

      // Prevent deleting system fields
      if (existing.isSystem) {
        res.status(403).json({
          success: false,
          message: "Cannot delete system context fields",
        });
        return;
      }

      const deleted = await ContextFieldModel.delete(fieldId);

      if (deleted) {
        res.json({
          success: true,
          message: "Context field deleted successfully",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to delete context field",
        });
      }
    } catch (error) {
      logger.error("Error deleting context field:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete context field",
      });
    }
  }

  /**
   * Validate conditions
   */
  static async validateConditions(req: Request, res: Response): Promise<void> {
    try {
      const { conditions } = req.body;

      // Basic validation for now
      if (!Array.isArray(conditions)) {
        res.status(400).json({
          success: false,
          message: "Conditions must be an array",
        });
        return;
      }

      res.json({
        success: true,
        data: { valid: true, message: "Conditions are valid" },
      });
    } catch (error) {
      logger.error("Error validating conditions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate conditions",
      });
    }
  }

  /**
   * Test conditions against sample data
   */
  static async testConditions(req: Request, res: Response): Promise<void> {
    try {
      const { conditions, context } = req.body;

      // Simple test implementation
      res.json({
        success: true,
        data: {
          result: true,
          message: "Conditions test completed",
          matchedConditions: conditions?.length || 0,
        },
      });
    } catch (error) {
      logger.error("Error testing conditions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to test conditions",
      });
    }
  }

  /**
   * Get sample contexts for testing
   */
  static async getSampleContexts(req: Request, res: Response): Promise<void> {
    try {
      const sampleContexts = [
        {
          userId: "12345",
          userLevel: 25,
          isPremium: true,
          platform: "ios",
          country: "KR",
          registrationDays: 30,
          lastLoginDays: 1,
          totalPurchases: 5,
          averageSessionMinutes: 45,
        },
        {
          userId: "67890",
          userLevel: 5,
          isPremium: false,
          platform: "android",
          country: "US",
          registrationDays: 3,
          lastLoginDays: 0,
          totalPurchases: 0,
          averageSessionMinutes: 15,
        },
      ];

      res.json({
        success: true,
        data: { contexts: sampleContexts },
      });
    } catch (error) {
      logger.error("Error getting sample contexts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get sample contexts",
      });
    }
  }
}
