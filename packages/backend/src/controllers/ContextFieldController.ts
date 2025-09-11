import { Request, Response } from 'express';
import { CONTEXT_FIELDS, CONTEXT_OPERATORS, ContextFieldDefinition, ContextOperator } from '../types/contextFields';
import logger from '../config/logger';

export class ContextFieldController {
  /**
   * Get all available context fields
   */
  static async getContextFields(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          fields: CONTEXT_FIELDS,
          operators: CONTEXT_OPERATORS
        }
      });
    } catch (error) {
      logger.error('Error getting context fields:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get context fields'
      });
    }
  }

  /**
   * Get context field by key
   */
  static async getContextField(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      
      const field = CONTEXT_FIELDS.find(f => f.key === key);
      if (!field) {
        res.status(404).json({
          success: false,
          message: 'Context field not found'
        });
        return;
      }

      res.json({
        success: true,
        data: field
      });
    } catch (error) {
      logger.error('Error getting context field:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get context field'
      });
    }
  }

  /**
   * Get operators for a specific field type
   */
  static async getOperatorsForFieldType(req: Request, res: Response): Promise<void> {
    try {
      const { fieldType } = req.params;
      
      const operators = CONTEXT_OPERATORS.filter(op => 
        op.supportedFieldTypes.includes(fieldType as any)
      );

      res.json({
        success: true,
        data: operators
      });
    } catch (error) {
      logger.error('Error getting operators for field type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get operators'
      });
    }
  }

  /**
   * Validate target conditions
   */
  static async validateConditions(req: Request, res: Response): Promise<void> {
    try {
      const { conditions } = req.body;
      
      const validationErrors: string[] = [];

      if (!Array.isArray(conditions)) {
        validationErrors.push('Conditions must be an array');
      } else {
        conditions.forEach((condition, index) => {
          const field = CONTEXT_FIELDS.find(f => f.key === condition.field);
          if (!field) {
            validationErrors.push(`Invalid field at index ${index}: ${condition.field}`);
            return;
          }

          const operator = CONTEXT_OPERATORS.find(op => op.key === condition.operator);
          if (!operator) {
            validationErrors.push(`Invalid operator at index ${index}: ${condition.operator}`);
            return;
          }

          if (!operator.supportedFieldTypes.includes(field.type)) {
            validationErrors.push(`Operator ${condition.operator} not supported for field type ${field.type} at index ${index}`);
            return;
          }

          // Validate value based on field type and operator
          if (operator.valueType === 'single' && condition.value === undefined) {
            validationErrors.push(`Value required for condition at index ${index}`);
          }

          if (operator.valueType === 'multiple' && !Array.isArray(condition.value)) {
            validationErrors.push(`Array value required for condition at index ${index}`);
          }

          // Type-specific validation
          if (field.type === 'number' && operator.valueType === 'single') {
            if (typeof condition.value !== 'number') {
              validationErrors.push(`Number value required for field ${field.key} at index ${index}`);
            }
          }

          if (field.type === 'boolean' && operator.valueType === 'single') {
            if (typeof condition.value !== 'boolean') {
              validationErrors.push(`Boolean value required for field ${field.key} at index ${index}`);
            }
          }

          if (field.type === 'version' && operator.valueType === 'single') {
            if (typeof condition.value !== 'string' || !/^\d+\.\d+\.\d+/.test(condition.value)) {
              validationErrors.push(`Valid version string required for field ${field.key} at index ${index}`);
            }
          }
        });
      }

      res.json({
        success: true,
        data: {
          isValid: validationErrors.length === 0,
          errors: validationErrors
        }
      });
    } catch (error) {
      logger.error('Error validating conditions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate conditions'
      });
    }
  }

  /**
   * Test conditions against sample user context
   */
  static async testConditions(req: Request, res: Response): Promise<void> {
    try {
      const { conditions, userContext } = req.body;
      
      // Import evaluation engine dynamically to avoid circular dependencies
      const { CampaignEvaluationEngine } = await import('../services/CampaignEvaluationEngine');
      
      const result = CampaignEvaluationEngine.evaluateConditions(conditions, userContext);

      res.json({
        success: true,
        data: {
          result,
          userContext,
          conditions
        }
      });
    } catch (error) {
      logger.error('Error testing conditions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test conditions'
      });
    }
  }

  /**
   * Get sample user contexts for testing
   */
  static async getSampleContexts(req: Request, res: Response): Promise<void> {
    try {
      const sampleContexts = [
        {
          name: 'New Player',
          context: {
            userLevel: 1,
            country: 'KR',
            appVersion: '1.0.0',
            platform: 'android',
            language: 'ko',
            isPremium: false,
            registrationDate: 0,
            lastLoginDate: 0,
            totalPurchases: 0,
            gameMode: 'tutorial',
            tags: ['new_user']
          }
        },
        {
          name: 'Premium Player',
          context: {
            userLevel: 25,
            country: 'US',
            appVersion: '1.2.0',
            platform: 'ios',
            language: 'en',
            isPremium: true,
            registrationDate: 30,
            lastLoginDate: 1,
            totalPurchases: 99.99,
            gameMode: 'normal',
            tags: ['premium', 'active']
          }
        },
        {
          name: 'High Level Player',
          context: {
            userLevel: 80,
            country: 'JP',
            appVersion: '1.1.5',
            platform: 'web',
            language: 'ja',
            isPremium: false,
            registrationDate: 120,
            lastLoginDate: 0,
            totalPurchases: 49.99,
            gameMode: 'expert',
            tags: ['veteran', 'hardcore']
          }
        }
      ];

      res.json({
        success: true,
        data: sampleContexts
      });
    } catch (error) {
      logger.error('Error getting sample contexts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sample contexts'
      });
    }
  }
}
