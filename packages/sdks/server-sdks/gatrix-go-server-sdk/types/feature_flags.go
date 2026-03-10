package types

// FeatureFlag represents a feature flag definition
type FeatureFlag struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	IsEnabled     bool              `json:"isEnabled"`
	Strategies    []FeatureStrategy `json:"strategies,omitempty"`
	Variants      []Variant         `json:"variants,omitempty"`
	ValueType     string            `json:"valueType,omitempty"`     // string, number, boolean, json
	EnabledValue  interface{}       `json:"enabledValue,omitempty"`  // Value when enabled (no strategy match)
	DisabledValue interface{}       `json:"disabledValue,omitempty"` // Value when disabled
	ValueSource   string            `json:"valueSource,omitempty"`   // environment or flag
}

// FeatureStrategy represents a targeting strategy
type FeatureStrategy struct {
	Name        string              `json:"name"`
	Parameters  *StrategyParameters `json:"parameters,omitempty"`
	Constraints []Constraint        `json:"constraints,omitempty"`
	Segments    []string            `json:"segments,omitempty"` // Segment name references
	IsEnabled   bool                `json:"isEnabled"`
}

// StrategyParameters holds rollout parameters
type StrategyParameters struct {
	Rollout    *float64 `json:"rollout,omitempty"`
	Stickiness string   `json:"stickiness,omitempty"`
	GroupID    string   `json:"groupId,omitempty"`
}

// Constraint represents a targeting constraint
type Constraint struct {
	ContextName     string   `json:"contextName"`
	Operator        string   `json:"operator"` // ConstraintOperator
	Value           string   `json:"value,omitempty"`
	Values          []string `json:"values,omitempty"`
	CaseInsensitive bool     `json:"caseInsensitive,omitempty"`
	Inverted        bool     `json:"inverted,omitempty"`
}

// Variant represents a flag variant
type Variant struct {
	Name    string      `json:"name"`
	Weight  int         `json:"weight"`
	Value   interface{} `json:"value,omitempty"`
	Enabled bool        `json:"enabled"`
}

// FeatureSegment represents a feature segment
type FeatureSegment struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	IsActive    bool         `json:"isActive"`
	Constraints []Constraint `json:"constraints,omitempty"`
}

// EvaluationContext holds user/session context for flag evaluation
type EvaluationContext struct {
	UserID        string                 `json:"userId,omitempty"`
	SessionID     string                 `json:"sessionId,omitempty"`
	AppName       string                 `json:"appName,omitempty"`
	AppVersion    string                 `json:"appVersion,omitempty"`
	RemoteAddress string                 `json:"remoteAddress,omitempty"`
	Properties    map[string]interface{} `json:"properties,omitempty"`
}

// EvaluationReason is the reason for evaluation result
type EvaluationReason string

const (
	ReasonDisabled      EvaluationReason = "disabled"
	ReasonDefault       EvaluationReason = "default"
	ReasonStrategyMatch EvaluationReason = "strategy_match"
	ReasonNotFound      EvaluationReason = "not_found"
)

// EvaluationResult holds the result of a flag evaluation
type EvaluationResult struct {
	ID       string           `json:"id"`
	FlagName string           `json:"flagName"`
	Enabled  bool             `json:"enabled"`
	Reason   EvaluationReason `json:"reason"`
	Variant  *Variant         `json:"variant,omitempty"`
}

// EvaluationDetail holds evaluation result with details
type EvaluationDetail[T any] struct {
	Value       T                `json:"value"`
	Reason      EvaluationReason `json:"reason"`
	FlagName    string           `json:"flagName"`
	VariantName string           `json:"variantName,omitempty"`
}

// VALUE_SOURCE constants
const (
	ValueSourceEnvDefaultEnabled   = "env:default:enabled"
	ValueSourceEnvDefaultDisabled  = "env:default:disabled"
	ValueSourceFlagDefaultEnabled  = "flag:default:enabled"
	ValueSourceFlagDefaultDisabled = "flag:default:disabled"
	ValueSourceMissing             = "missing"
)

// FlagMetric represents a single flag evaluation metric
type FlagMetric struct {
	EnvironmentID string `json:"environmentId"`
	FlagName      string `json:"flagName"`
	Enabled       bool   `json:"enabled"`
	VariantName   string `json:"variantName,omitempty"`
}

// FlagMetricsPayload is the payload sent to the metrics endpoint
type FlagMetricsPayload struct {
	Metrics    []AggregatedMetric `json:"metrics"`
	Bucket     MetricsBucket      `json:"bucket"`
	Timestamp  string             `json:"timestamp"`
	SDKVersion string             `json:"sdkVersion"`
}

// AggregatedMetric represents an aggregated metric
type AggregatedMetric struct {
	FlagName    string `json:"flagName"`
	Enabled     bool   `json:"enabled"`
	VariantName string `json:"variantName,omitempty"`
	Count       int    `json:"count"`
}

// MetricsBucket represents a time window for metrics
type MetricsBucket struct {
	Start string `json:"start"`
	Stop  string `json:"stop"`
}

// FeatureFlagsAPIResponse is the API response for GET /api/v1/server/features
type FeatureFlagsAPIResponse struct {
	Flags     []FeatureFlag    `json:"flags"`
	Segments  []FeatureSegment `json:"segments"`
	ProjectID string           `json:"projectId,omitempty"`
}
