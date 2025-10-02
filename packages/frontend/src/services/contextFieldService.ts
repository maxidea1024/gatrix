import api from './api';

export interface ContextFieldDefinition {
  key: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'version';
  operators: string[];
  defaultValue?: any;
  options?: ContextFieldOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export interface ContextFieldOption {
  value: string | number;
  label: string;
  description?: string;
}

export interface ContextOperator {
  key: string;
  name: string;
  description: string;
  valueType: 'single' | 'multiple' | 'none';
  supportedFieldTypes: ('string' | 'number' | 'boolean' | 'array' | 'version')[];
}

export interface TargetCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface TargetConditionGroup {
  conditions: TargetCondition[];
  logicalOperator: 'AND' | 'OR';
  groups?: TargetConditionGroup[];
}

export interface SampleContext {
  name: string;
  context: Record<string, any>;
}

class ContextFieldService {
  /**
   * Get all available context fields and operators
   */
  async getContextFields(): Promise<{
    fields: ContextFieldDefinition[];
    operators: ContextOperator[];
  }> {
    const response = await api.get('/context-fields');
    return response.data;
  }

  /**
   * Get specific context field by key
   */
  async getContextField(key: string): Promise<ContextFieldDefinition> {
    const response = await api.get(`/context-fields/${key}`);
    return response.data;
  }

  /**
   * Get operators for specific field type
   */
  async getOperatorsForFieldType(fieldType: string): Promise<ContextOperator[]> {
    const response = await api.get(`/context-fields/operators/${fieldType}`);
    return response.data;
  }

  /**
   * Validate target conditions
   */
  async validateConditions(conditions: TargetCondition[]): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const response = await api.post('/context-fields/validate', {
      conditions
    });
    return response.data;
  }

  /**
   * Test conditions against user context
   */
  async testConditions(conditions: TargetCondition[], userContext: Record<string, any>): Promise<{
    result: boolean;
    userContext: Record<string, any>;
    conditions: TargetCondition[];
  }> {
    const response = await api.post('/context-fields/test', {
      conditions,
      userContext
    });
    return response.data;
  }

  /**
   * Get sample user contexts for testing
   */
  async getSampleContexts(): Promise<SampleContext[]> {
    const response = await api.get('/context-fields/samples/contexts');
    return response.data;
  }

  /**
   * Helper: Get operators for a field
   */
  getOperatorsForField(field: ContextFieldDefinition, allOperators: ContextOperator[]): ContextOperator[] {
    return allOperators.filter(op => 
      op.supportedFieldTypes.includes(field.type) && 
      field.operators.includes(op.key)
    );
  }

  /**
   * Helper: Format condition value for display
   */
  formatConditionValue(condition: TargetCondition, field: ContextFieldDefinition): string {
    if (condition.value === null || condition.value === undefined) {
      return '';
    }

    if (Array.isArray(condition.value)) {
      return condition.value.join(', ');
    }

    if (field.type === 'boolean') {
      return condition.value ? 'True' : 'False';
    }

    if (field.options) {
      const option = field.options.find(opt => opt.value === condition.value);
      return option ? option.label : String(condition.value);
    }

    return String(condition.value);
  }

  /**
   * Helper: Get field display name
   */
  getFieldDisplayName(fieldKey: string, fields: ContextFieldDefinition[]): string {
    const field = fields.find(f => f.key === fieldKey);
    return field ? field.name : fieldKey;
  }

  /**
   * Helper: Get operator display name
   */
  getOperatorDisplayName(operatorKey: string, operators: ContextOperator[]): string {
    const operator = operators.find(op => op.key === operatorKey);
    return operator ? operator.name : operatorKey;
  }

  /**
   * Helper: Create empty condition
   */
  createEmptyCondition(fields: ContextFieldDefinition[]): TargetCondition {
    const firstField = fields[0];
    const firstOperator = firstField?.operators[0];
    
    return {
      field: firstField?.key || '',
      operator: firstOperator || 'equals',
      value: firstField?.defaultValue || '',
      logicalOperator: 'AND'
    };
  }

  /**
   * Helper: Validate single condition
   */
  validateSingleCondition(
    condition: TargetCondition, 
    field: ContextFieldDefinition, 
    operator: ContextOperator
  ): string[] {
    const errors: string[] = [];

    if (!field) {
      errors.push('Invalid field');
      return errors;
    }

    if (!operator) {
      errors.push('Invalid operator');
      return errors;
    }

    if (!operator.supportedFieldTypes.includes(field.type)) {
      errors.push(`Operator ${operator.name} not supported for field type ${field.type}`);
      return errors;
    }

    // Value validation
    if (operator.valueType === 'single' && (condition.value === null || condition.value === undefined || condition.value === '')) {
      errors.push('Value is required');
    }

    if (operator.valueType === 'multiple' && (!Array.isArray(condition.value) || condition.value.length === 0)) {
      errors.push('At least one value is required');
    }

    // Type-specific validation
    if (field.type === 'number' && operator.valueType === 'single') {
      if (isNaN(Number(condition.value))) {
        errors.push('Value must be a number');
      }
    }

    if (field.type === 'version' && operator.valueType === 'single') {
      if (!/^\d+\.\d+\.\d+/.test(String(condition.value))) {
        errors.push('Value must be a valid version (e.g., 1.0.0)');
      }
    }

    return errors;
  }
}

export default new ContextFieldService();
