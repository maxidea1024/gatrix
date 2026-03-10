package evaluator

import (
	"testing"

	"github.com/gatrix/gatrix-go-server-sdk/types"
)

func floatPtr(f float64) *float64 { return &f }

// --- Evaluate: disabled flag ---
func TestEvaluate_DisabledFlag(t *testing.T) {
	flag := types.FeatureFlag{
		ID:            "f1",
		Name:          "disabled-flag",
		IsEnabled:     false,
		DisabledValue: "off",
		ValueType:     "string",
	}
	ctx := types.EvaluationContext{}
	result := Evaluate(flag, ctx, nil)

	if result.Enabled {
		t.Error("Expected flag to be disabled")
	}
	if result.Reason != types.ReasonDisabled {
		t.Errorf("Expected reason 'disabled', got '%s'", result.Reason)
	}
	if result.Variant == nil || result.Variant.Value != "off" {
		t.Errorf("Expected variant value 'off', got %v", result.Variant)
	}
}

// --- Evaluate: enabled flag with no strategies ---
func TestEvaluate_EnabledNoStrategies(t *testing.T) {
	flag := types.FeatureFlag{
		ID:           "f2",
		Name:         "enabled-flag",
		IsEnabled:    true,
		EnabledValue: "on",
		ValueType:    "string",
	}
	result := Evaluate(flag, types.EvaluationContext{}, nil)

	if !result.Enabled {
		t.Error("Expected flag to be enabled")
	}
	if result.Reason != types.ReasonDefault {
		t.Errorf("Expected reason 'default', got '%s'", result.Reason)
	}
	if result.Variant == nil || result.Variant.Value != "on" {
		t.Errorf("Expected variant value 'on', got %v", result.Variant)
	}
}

// --- Evaluate: strategy match with constraint ---
func TestEvaluate_StrategyMatch(t *testing.T) {
	flag := types.FeatureFlag{
		ID:        "f3",
		Name:      "strategy-flag",
		IsEnabled: true,
		Strategies: []types.FeatureStrategy{
			{
				Name:      "target-users",
				IsEnabled: true,
				Constraints: []types.Constraint{
					{ContextName: "userId", Operator: "str_eq", Value: "user-123"},
				},
			},
		},
		EnabledValue:  "matched",
		DisabledValue: "not-matched",
		ValueType:     "string",
	}
	ctx := types.EvaluationContext{UserID: "user-123"}
	result := Evaluate(flag, ctx, nil)

	if !result.Enabled {
		t.Error("Expected strategy to match")
	}
	if result.Reason != types.ReasonStrategyMatch {
		t.Errorf("Expected reason 'strategy_match', got '%s'", result.Reason)
	}
}

// --- Evaluate: strategy not matched ---
func TestEvaluate_StrategyNotMatched(t *testing.T) {
	flag := types.FeatureFlag{
		ID:        "f4",
		Name:      "no-match-flag",
		IsEnabled: true,
		Strategies: []types.FeatureStrategy{
			{
				Name:      "target-users",
				IsEnabled: true,
				Constraints: []types.Constraint{
					{ContextName: "userId", Operator: "str_eq", Value: "user-999"},
				},
			},
		},
		DisabledValue: "fallback",
		ValueType:     "string",
	}
	ctx := types.EvaluationContext{UserID: "user-123"}
	result := Evaluate(flag, ctx, nil)

	if result.Enabled {
		t.Error("Expected strategy to not match")
	}
	if result.Reason != types.ReasonDefault {
		t.Errorf("Expected reason 'default', got '%s'", result.Reason)
	}
}

// --- Constraint operators ---

func TestConstraint_StrContains(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c1", Name: "contains-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "appName", Operator: "str_contains", Value: "game"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{AppName: "my-game-server"}, nil)
	if !result.Enabled {
		t.Error("Expected str_contains to match")
	}

	result = Evaluate(flag, types.EvaluationContext{AppName: "web-server"}, nil)
	if result.Enabled && result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected str_contains to not match")
	}
}

func TestConstraint_StrIn(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c2", Name: "in-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "str_in", Values: []string{"user-1", "user-2", "user-3"}},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{UserID: "user-2"}, nil)
	if !result.Enabled {
		t.Error("Expected str_in to match")
	}

	result = Evaluate(flag, types.EvaluationContext{UserID: "user-99"}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected str_in to not match")
	}
}

func TestConstraint_NumGt(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c3", Name: "num-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "level", Operator: "num_gt", Value: "10"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	ctx := types.EvaluationContext{
		Properties: map[string]interface{}{"level": 15},
	}
	result := Evaluate(flag, ctx, nil)
	if !result.Enabled {
		t.Error("Expected num_gt to match (15 > 10)")
	}

	ctx.Properties["level"] = 5
	result = Evaluate(flag, ctx, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected num_gt to not match (5 > 10)")
	}
}

func TestConstraint_Exists(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c4", Name: "exists-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "exists"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{UserID: "user-1"}, nil)
	if !result.Enabled {
		t.Error("Expected exists to match when userId present")
	}

	result = Evaluate(flag, types.EvaluationContext{}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected exists to not match when userId empty")
	}
}

func TestConstraint_Inverted(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c5", Name: "inverted-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "str_eq", Value: "admin", Inverted: true},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	// "admin" should NOT match (inverted)
	result := Evaluate(flag, types.EvaluationContext{UserID: "admin"}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected inverted str_eq to not match for 'admin'")
	}
	// "user-1" should match (inverted)
	result = Evaluate(flag, types.EvaluationContext{UserID: "user-1"}, nil)
	if !result.Enabled {
		t.Error("Expected inverted str_eq to match for 'user-1'")
	}
}

func TestConstraint_CaseInsensitive(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c6", Name: "case-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "str_eq", Value: "Admin", CaseInsensitive: true},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{UserID: "admin"}, nil)
	if !result.Enabled {
		t.Error("Expected case-insensitive match")
	}
}

func TestConstraint_SemverGte(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "c7", Name: "semver-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "appVersion", Operator: "semver_gte", Value: "2.0.0"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{AppVersion: "2.1.0"}, nil)
	if !result.Enabled {
		t.Error("Expected semver_gte to match (2.1.0 >= 2.0.0)")
	}
	result = Evaluate(flag, types.EvaluationContext{AppVersion: "1.9.0"}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected semver_gte to not match (1.9.0 >= 2.0.0)")
	}
}

// --- Segment evaluation ---
func TestEvaluate_WithSegment(t *testing.T) {
	segments := map[string]types.FeatureSegment{
		"beta-users": {
			Name: "beta-users",
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "str_in", Values: []string{"user-1", "user-2"}},
			},
		},
	}
	flag := types.FeatureFlag{
		ID: "s1", Name: "segment-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Segments: []string{"beta-users"},
		}},
		EnabledValue: true, ValueType: "boolean",
	}

	result := Evaluate(flag, types.EvaluationContext{UserID: "user-1"}, segments)
	if !result.Enabled {
		t.Error("Expected segment match for user-1")
	}

	result = Evaluate(flag, types.EvaluationContext{UserID: "user-99"}, segments)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected segment to not match for user-99")
	}
}

// --- Rollout ---
func TestEvaluate_Rollout(t *testing.T) {
	rollout0 := 0.0
	flag := types.FeatureFlag{
		ID: "r1", Name: "rollout-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Parameters: &types.StrategyParameters{Rollout: &rollout0},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	// With 0% rollout, nobody should match
	result := Evaluate(flag, types.EvaluationContext{UserID: "user-123"}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected 0% rollout to not match")
	}
}

// --- Variant selection ---
func TestEvaluate_VariantSelection(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "v1", Name: "variant-flag", IsEnabled: true,
		Variants: []types.Variant{
			{Name: "control", Weight: 50, Value: "A"},
			{Name: "treatment", Weight: 50, Value: "B"},
		},
		EnabledValue: "default",
		ValueType:    "string",
	}
	// Evaluate for a specific user - should consistently get one variant
	result := Evaluate(flag, types.EvaluationContext{UserID: "user-test"}, nil)
	if result.Variant == nil {
		t.Fatal("Expected variant to be selected")
	}
	if result.Variant.Name != "control" && result.Variant.Name != "treatment" {
		t.Errorf("Unexpected variant name: %s", result.Variant.Name)
	}

	// Same user should get same variant (stickiness)
	result2 := Evaluate(flag, types.EvaluationContext{UserID: "user-test"}, nil)
	if result2.Variant.Name != result.Variant.Name {
		t.Error("Expected same variant for same user (stickiness)")
	}
}

// --- GetFallbackValue ---
func TestGetFallbackValue(t *testing.T) {
	// Nil values
	if GetFallbackValue(nil, "boolean") != false {
		t.Error("Expected false for nil boolean")
	}
	if GetFallbackValue(nil, "number") != float64(0) {
		t.Error("Expected 0 for nil number")
	}
	if GetFallbackValue(nil, "string") != "" {
		t.Error("Expected empty string for nil string")
	}

	// String coercion
	if GetFallbackValue(42, "string") != "42" {
		t.Error("Expected '42' for int-to-string coercion")
	}

	// Boolean coercion
	if GetFallbackValue("true", "boolean") != true {
		t.Error("Expected true for 'true' string")
	}
	if GetFallbackValue("false", "boolean") != false {
		t.Error("Expected false for 'false' string")
	}

	// Number coercion
	if GetFallbackValue("42.5", "number") != 42.5 {
		t.Error("Expected 42.5 for '42.5' string")
	}
}

// --- Array operators ---
func TestConstraint_ArrAny(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "a1", Name: "arr-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "tags", Operator: "arr_any", Values: []string{"vip", "premium"}},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	ctx := types.EvaluationContext{
		Properties: map[string]interface{}{
			"tags": []interface{}{"basic", "vip"},
		},
	}
	result := Evaluate(flag, ctx, nil)
	if !result.Enabled {
		t.Error("Expected arr_any to match (tags contains 'vip')")
	}
}

func TestConstraint_ArrEmpty(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "a2", Name: "arr-empty-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "items", Operator: "arr_empty"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	// Empty array
	ctx := types.EvaluationContext{Properties: map[string]interface{}{"items": []interface{}{}}}
	result := Evaluate(flag, ctx, nil)
	if !result.Enabled {
		t.Error("Expected arr_empty to match for empty array")
	}

	// Missing field should also match
	result = Evaluate(flag, types.EvaluationContext{}, nil)
	if !result.Enabled {
		t.Error("Expected arr_empty to match for missing field")
	}
}

// --- Regex ---
func TestConstraint_StrRegex(t *testing.T) {
	flag := types.FeatureFlag{
		ID: "rx", Name: "regex-flag", IsEnabled: true,
		Strategies: []types.FeatureStrategy{{
			Name: "s", IsEnabled: true,
			Constraints: []types.Constraint{
				{ContextName: "userId", Operator: "str_regex", Value: "^user-\\d+$"},
			},
		}},
		EnabledValue: true, ValueType: "boolean",
	}
	result := Evaluate(flag, types.EvaluationContext{UserID: "user-123"}, nil)
	if !result.Enabled {
		t.Error("Expected regex to match user-123")
	}
	result = Evaluate(flag, types.EvaluationContext{UserID: "admin"}, nil)
	if result.Reason == types.ReasonStrategyMatch {
		t.Error("Expected regex to not match admin")
	}
}
