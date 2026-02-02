// Context Field Types for Campaign Targeting

export interface ContextFieldDefinition {
  key: string;
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array" | "version";
  operators: string[];
  defaultValue?: any;
  options?: ContextFieldOption[]; // For enum-like fields
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
  valueType: "single" | "multiple" | "none";
  supportedFieldTypes: (
    | "string"
    | "number"
    | "boolean"
    | "array"
    | "version"
  )[];
}

export interface TargetCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: "AND" | "OR";
}

export interface TargetConditionGroup {
  conditions: TargetCondition[];
  logicalOperator: "AND" | "OR";
  groups?: TargetConditionGroup[];
}

// Predefined Context Fields
export const CONTEXT_FIELDS: ContextFieldDefinition[] = [
  {
    key: "userLevel",
    name: "User Level",
    description: "User's current level in the game",
    type: "number",
    operators: [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
      "in",
      "not_in",
    ],
    defaultValue: 1,
    validation: { min: 1, max: 999 },
  },
  {
    key: "country",
    name: "Country",
    description: "User's country code (ISO 3166-1 alpha-2)",
    type: "string",
    operators: ["equals", "not_equals", "in", "not_in"],
    options: [
      { value: "KR", label: "South Korea" },
      { value: "US", label: "United States" },
      { value: "JP", label: "Japan" },
      { value: "CN", label: "China" },
      { value: "GB", label: "United Kingdom" },
      { value: "DE", label: "Germany" },
      { value: "FR", label: "France" },
    ],
  },
  {
    key: "appVersion",
    name: "App Version",
    description: "Application version (semantic versioning)",
    type: "version",
    operators: [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
    ],
    defaultValue: "1.0.0",
  },
  {
    key: "platform",
    name: "Platform",
    description: "User's platform/device type",
    type: "string",
    operators: ["equals", "not_equals", "in", "not_in"],
    options: [
      { value: "ios", label: "iOS" },
      { value: "android", label: "Android" },
      { value: "web", label: "Web Browser" },
      { value: "windows", label: "Windows" },
      { value: "mac", label: "macOS" },
      { value: "linux", label: "Linux" },
    ],
  },
  {
    key: "language",
    name: "Language",
    description: "User's preferred language",
    type: "string",
    operators: ["equals", "not_equals", "in", "not_in"],
    options: [
      { value: "ko", label: "한국어" },
      { value: "en", label: "English" },
      { value: "ja", label: "日本語" },
      { value: "zh", label: "中文" },
      { value: "es", label: "Español" },
      { value: "fr", label: "Français" },
      { value: "de", label: "Deutsch" },
    ],
  },
  {
    key: "isPremium",
    name: "Premium User",
    description: "Whether the user has premium subscription",
    type: "boolean",
    operators: ["equals", "not_equals"],
    defaultValue: false,
  },
  {
    key: "registrationDate",
    name: "Registration Date",
    description: "User registration date (days ago)",
    type: "number",
    operators: [
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
    ],
    defaultValue: 0,
    validation: { min: 0 },
  },
  {
    key: "lastLoginDate",
    name: "Last Login",
    description: "Days since last login",
    type: "number",
    operators: [
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
    ],
    defaultValue: 0,
    validation: { min: 0 },
  },
  {
    key: "totalPurchases",
    name: "Total Purchases",
    description: "Total amount of purchases (USD)",
    type: "number",
    operators: [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
    ],
    defaultValue: 0,
    validation: { min: 0 },
  },
  {
    key: "gameMode",
    name: "Game Mode",
    description: "Current game mode or world",
    type: "string",
    operators: ["equals", "not_equals", "in", "not_in"],
    options: [
      { value: "tutorial", label: "Tutorial" },
      { value: "normal", label: "Normal Mode" },
      { value: "hard", label: "Hard Mode" },
      { value: "expert", label: "Expert Mode" },
      { value: "pvp", label: "PvP Mode" },
      { value: "guild", label: "Guild Mode" },
    ],
  },
  {
    key: "tags",
    name: "User Tags",
    description: "Custom tags assigned to user",
    type: "array",
    operators: ["contains", "not_contains", "contains_any", "contains_all"],
    defaultValue: [],
  },
];

// Predefined Operators
export const CONTEXT_OPERATORS: ContextOperator[] = [
  {
    key: "equals",
    name: "Equals",
    description: "Field value equals the specified value",
    valueType: "single",
    supportedFieldTypes: ["string", "number", "boolean", "version"],
  },
  {
    key: "not_equals",
    name: "Not Equals",
    description: "Field value does not equal the specified value",
    valueType: "single",
    supportedFieldTypes: ["string", "number", "boolean", "version"],
  },
  {
    key: "greater_than",
    name: "Greater Than",
    description: "Field value is greater than the specified value",
    valueType: "single",
    supportedFieldTypes: ["number", "version"],
  },
  {
    key: "less_than",
    name: "Less Than",
    description: "Field value is less than the specified value",
    valueType: "single",
    supportedFieldTypes: ["number", "version"],
  },
  {
    key: "greater_than_or_equal",
    name: "Greater Than or Equal",
    description: "Field value is greater than or equal to the specified value",
    valueType: "single",
    supportedFieldTypes: ["number", "version"],
  },
  {
    key: "less_than_or_equal",
    name: "Less Than or Equal",
    description: "Field value is less than or equal to the specified value",
    valueType: "single",
    supportedFieldTypes: ["number", "version"],
  },
  {
    key: "in",
    name: "In",
    description: "Field value is in the specified list",
    valueType: "multiple",
    supportedFieldTypes: ["string", "number"],
  },
  {
    key: "not_in",
    name: "Not In",
    description: "Field value is not in the specified list",
    valueType: "multiple",
    supportedFieldTypes: ["string", "number"],
  },
  {
    key: "contains",
    name: "Contains",
    description: "Array field contains the specified value",
    valueType: "single",
    supportedFieldTypes: ["array"],
  },
  {
    key: "not_contains",
    name: "Not Contains",
    description: "Array field does not contain the specified value",
    valueType: "single",
    supportedFieldTypes: ["array"],
  },
  {
    key: "contains_any",
    name: "Contains Any",
    description: "Array field contains any of the specified values",
    valueType: "multiple",
    supportedFieldTypes: ["array"],
  },
  {
    key: "contains_all",
    name: "Contains All",
    description: "Array field contains all of the specified values",
    valueType: "multiple",
    supportedFieldTypes: ["array"],
  },
];
