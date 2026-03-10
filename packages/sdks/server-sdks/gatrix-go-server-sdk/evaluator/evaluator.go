package evaluator

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/types"
	"github.com/spaolacci/murmur3"
)

// Evaluate evaluates a single feature flag
func Evaluate(flag types.FeatureFlag, ctx types.EvaluationContext, segments map[string]types.FeatureSegment) types.EvaluationResult {
	var reason types.EvaluationReason = types.ReasonDisabled

	if flag.IsEnabled {
		activeStrategies := filterEnabledStrategies(flag.Strategies)

		if len(activeStrategies) > 0 {
			for _, strategy := range activeStrategies {
				if evaluateStrategy(strategy, ctx, flag, segments) {
					variant := selectVariant(flag, ctx, &strategy)
					defaultName := types.ValueSourceFlagDefaultEnabled
					if flag.ValueSource == "environment" {
						defaultName = types.ValueSourceEnvDefaultEnabled
					}

					varName := defaultName
					varWeight := 100
					var varValue interface{}
					if variant != nil {
						varName = variant.Name
						varWeight = variant.Weight
						varValue = variant.Value
					}
					if varValue == nil {
						varValue = flag.EnabledValue
					}

					return types.EvaluationResult{
						ID:       flag.ID,
						FlagName: flag.Name,
						Enabled:  true,
						Reason:   types.ReasonStrategyMatch,
						Variant: &types.Variant{
							Name:    varName,
							Weight:  varWeight,
							Value:   GetFallbackValue(varValue, flag.ValueType),
							Enabled: true,
						},
					}
				}
			}
			reason = types.ReasonDefault
		} else {
			// No strategies or all disabled - enabled by default
			variant := selectVariant(flag, ctx, nil)
			defaultName := types.ValueSourceFlagDefaultEnabled
			if flag.ValueSource == "environment" {
				defaultName = types.ValueSourceEnvDefaultEnabled
			}

			varName := defaultName
			varWeight := 100
			var varValue interface{}
			if variant != nil {
				varName = variant.Name
				varWeight = variant.Weight
				varValue = variant.Value
			}
			if varValue == nil {
				varValue = flag.EnabledValue
			}

			return types.EvaluationResult{
				ID:       flag.ID,
				FlagName: flag.Name,
				Enabled:  true,
				Reason:   types.ReasonDefault,
				Variant: &types.Variant{
					Name:    varName,
					Weight:  varWeight,
					Value:   GetFallbackValue(varValue, flag.ValueType),
					Enabled: true,
				},
			}
		}
	}

	// Disabled or no strategy matched
	defaultDisabledName := types.ValueSourceFlagDefaultDisabled
	if flag.ValueSource == "environment" {
		defaultDisabledName = types.ValueSourceEnvDefaultDisabled
	}

	return types.EvaluationResult{
		ID:       flag.ID,
		FlagName: flag.Name,
		Enabled:  false,
		Reason:   reason,
		Variant: &types.Variant{
			Name:    defaultDisabledName,
			Weight:  100,
			Value:   GetFallbackValue(flag.DisabledValue, flag.ValueType),
			Enabled: false,
		},
	}
}

func filterEnabledStrategies(strategies []types.FeatureStrategy) []types.FeatureStrategy {
	var active []types.FeatureStrategy
	for _, s := range strategies {
		if s.IsEnabled {
			active = append(active, s)
		}
	}
	return active
}

// evaluateStrategy evaluates a single strategy: segments -> constraints -> rollout
func evaluateStrategy(strategy types.FeatureStrategy, ctx types.EvaluationContext, flag types.FeatureFlag, segments map[string]types.FeatureSegment) bool {
	// 1. Check segment constraints
	if len(strategy.Segments) > 0 {
		for _, segName := range strategy.Segments {
			segment, exists := segments[segName]
			if !exists {
				continue
			}
			if len(segment.Constraints) > 0 {
				allPass := true
				for _, c := range segment.Constraints {
					if !evaluateConstraint(c, ctx) {
						allPass = false
						break
					}
				}
				if !allPass {
					return false
				}
			}
		}
	}

	// 2. Check strategy constraints
	if len(strategy.Constraints) > 0 {
		for _, c := range strategy.Constraints {
			if !evaluateConstraint(c, ctx) {
				return false
			}
		}
	}

	// 3. Check rollout percentage
	rollout := 100.0
	if strategy.Parameters != nil && strategy.Parameters.Rollout != nil {
		rollout = *strategy.Parameters.Rollout
	}
	if rollout < 100 {
		stickiness := "default"
		groupID := flag.Name
		if strategy.Parameters != nil {
			if strategy.Parameters.Stickiness != "" {
				stickiness = strategy.Parameters.Stickiness
			}
			if strategy.Parameters.GroupID != "" {
				groupID = strategy.Parameters.GroupID
			}
		}
		percentage := calculatePercentage(ctx, stickiness, groupID)
		if percentage > rollout {
			return false
		}
	}

	return true
}

func evaluateConstraint(constraint types.Constraint, ctx types.EvaluationContext) bool {
	contextValue := getContextValue(constraint.ContextName, ctx)

	// Handle exists/not_exists BEFORE nil check
	if constraint.Operator == "exists" {
		result := contextValue != nil
		return applyInverted(result, constraint.Inverted)
	}
	if constraint.Operator == "not_exists" {
		result := contextValue == nil
		return applyInverted(result, constraint.Inverted)
	}

	// Handle arr_empty BEFORE nil check
	if constraint.Operator == "arr_empty" {
		arr, ok := contextValue.([]interface{})
		result := !ok || len(arr) == 0
		return applyInverted(result, constraint.Inverted)
	}

	if contextValue == nil {
		return applyInverted(false, constraint.Inverted)
	}

	// Array operators
	if constraint.Operator == "arr_any" || constraint.Operator == "arr_all" {
		arr := toStringSlice(contextValue)
		targetValues := constraint.Values
		if constraint.CaseInsensitive {
			arr = toLowerSlice(arr)
			targetValues = toLowerSlice(targetValues)
		}

		var result bool
		if constraint.Operator == "arr_any" {
			result = anyInSlice(targetValues, arr)
		} else {
			result = len(targetValues) > 0 && allInSlice(targetValues, arr)
		}
		return applyInverted(result, constraint.Inverted)
	}

	stringValue := fmt.Sprintf("%v", contextValue)
	compareValue := stringValue
	targetValue := constraint.Value
	if constraint.CaseInsensitive {
		compareValue = strings.ToLower(stringValue)
		targetValue = strings.ToLower(constraint.Value)
	}
	targetValues := constraint.Values
	if constraint.CaseInsensitive {
		targetValues = toLowerSlice(targetValues)
	}

	var result bool

	switch constraint.Operator {
	// String
	case "str_eq":
		result = compareValue == targetValue
	case "str_contains":
		result = strings.Contains(compareValue, targetValue)
	case "str_starts_with":
		result = strings.HasPrefix(compareValue, targetValue)
	case "str_ends_with":
		result = strings.HasSuffix(compareValue, targetValue)
	case "str_in":
		result = containsString(targetValues, compareValue)
	case "str_regex":
		re, err := regexp.Compile(constraint.Value)
		if err != nil {
			result = false
		} else {
			if constraint.CaseInsensitive {
				re, err = regexp.Compile("(?i)" + constraint.Value)
				if err != nil {
					result = false
				} else {
					result = re.MatchString(stringValue)
				}
			} else {
				result = re.MatchString(stringValue)
			}
		}
	// Number
	case "num_eq":
		result = toFloat(contextValue) == toFloat(constraint.Value)
	case "num_gt":
		result = toFloat(contextValue) > toFloat(constraint.Value)
	case "num_gte":
		result = toFloat(contextValue) >= toFloat(constraint.Value)
	case "num_lt":
		result = toFloat(contextValue) < toFloat(constraint.Value)
	case "num_lte":
		result = toFloat(contextValue) <= toFloat(constraint.Value)
	case "num_in":
		cv := toFloat(contextValue)
		for _, v := range targetValues {
			if toFloat(v) == cv {
				result = true
				break
			}
		}
	// Boolean
	case "bool_is":
		result = toBool(contextValue) == (constraint.Value == "true")
	// Date
	case "date_eq":
		result = parseTime(stringValue).Equal(parseTime(targetValue))
	case "date_gt":
		result = parseTime(stringValue).After(parseTime(targetValue))
	case "date_gte":
		t1, t2 := parseTime(stringValue), parseTime(targetValue)
		result = t1.After(t2) || t1.Equal(t2)
	case "date_lt":
		result = parseTime(stringValue).Before(parseTime(targetValue))
	case "date_lte":
		t1, t2 := parseTime(stringValue), parseTime(targetValue)
		result = t1.Before(t2) || t1.Equal(t2)
	// Semver
	case "semver_eq":
		result = compareSemver(stringValue, targetValue) == 0
	case "semver_gt":
		result = compareSemver(stringValue, targetValue) > 0
	case "semver_gte":
		result = compareSemver(stringValue, targetValue) >= 0
	case "semver_lt":
		result = compareSemver(stringValue, targetValue) < 0
	case "semver_lte":
		result = compareSemver(stringValue, targetValue) <= 0
	case "semver_in":
		for _, v := range targetValues {
			if compareSemver(stringValue, v) == 0 {
				result = true
				break
			}
		}
	default:
		result = false
	}

	return applyInverted(result, constraint.Inverted)
}

func getContextValue(name string, ctx types.EvaluationContext) interface{} {
	switch name {
	case "userId":
		if ctx.UserID == "" {
			return nil
		}
		return ctx.UserID
	case "sessionId":
		if ctx.SessionID == "" {
			return nil
		}
		return ctx.SessionID
	case "appName":
		if ctx.AppName == "" {
			return nil
		}
		return ctx.AppName
	case "appVersion":
		if ctx.AppVersion == "" {
			return nil
		}
		return ctx.AppVersion
	case "remoteAddress":
		if ctx.RemoteAddress == "" {
			return nil
		}
		return ctx.RemoteAddress
	default:
		if ctx.Properties != nil {
			if v, ok := ctx.Properties[name]; ok {
				return v
			}
		}
		return nil
	}
}

func calculatePercentage(ctx types.EvaluationContext, stickiness, groupID string) float64 {
	var stickinessValue string
	switch stickiness {
	case "default", "userId":
		stickinessValue = ctx.UserID
		if stickinessValue == "" {
			stickinessValue = ctx.SessionID
		}
		if stickinessValue == "" {
			stickinessValue = fmt.Sprintf("%f", rand.Float64())
		}
	case "sessionId":
		stickinessValue = ctx.SessionID
		if stickinessValue == "" {
			stickinessValue = fmt.Sprintf("%f", rand.Float64())
		}
	case "random":
		stickinessValue = fmt.Sprintf("%f", rand.Float64())
	default:
		v := getContextValue(stickiness, ctx)
		if v != nil {
			stickinessValue = fmt.Sprintf("%v", v)
		} else {
			stickinessValue = fmt.Sprintf("%f", rand.Float64())
		}
	}

	seed := groupID + ":" + stickinessValue
	hash := murmur3.Sum32([]byte(seed))
	return float64(hash%10000) / 100.0
}

func selectVariant(flag types.FeatureFlag, ctx types.EvaluationContext, matchedStrategy *types.FeatureStrategy) *types.Variant {
	if len(flag.Variants) == 0 {
		return nil
	}

	totalWeight := 0
	for _, v := range flag.Variants {
		totalWeight += v.Weight
	}
	if totalWeight <= 0 {
		return nil
	}

	stickiness := "default"
	if matchedStrategy != nil && matchedStrategy.Parameters != nil && matchedStrategy.Parameters.Stickiness != "" {
		stickiness = matchedStrategy.Parameters.Stickiness
	}

	percentage := calculatePercentage(ctx, stickiness, flag.Name+"-variant")
	targetWeight := (percentage / 100.0) * float64(totalWeight)

	cumulativeWeight := 0.0
	for i := range flag.Variants {
		cumulativeWeight += float64(flag.Variants[i].Weight)
		if targetWeight <= cumulativeWeight {
			v := flag.Variants[i]
			return &v
		}
	}
	last := flag.Variants[len(flag.Variants)-1]
	return &last
}

// GetFallbackValue ensures values match the declared valueType
func GetFallbackValue(value interface{}, valueType string) interface{} {
	if value == nil {
		switch valueType {
		case "boolean":
			return false
		case "number":
			return float64(0)
		case "json":
			return map[string]interface{}{}
		case "string":
			return ""
		default:
			return ""
		}
	}

	switch valueType {
	case "string":
		if s, ok := value.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", value)
	case "number":
		return toFloat(value)
	case "boolean":
		return toBool(value)
	case "json":
		if m, ok := value.(map[string]interface{}); ok {
			return m
		}
		if s, ok := value.(string); ok {
			var result interface{}
			if err := json.Unmarshal([]byte(s), &result); err == nil {
				return result
			}
			return map[string]interface{}{}
		}
		return value
	default:
		return value
	}
}

// Helper functions

func applyInverted(result bool, inverted bool) bool {
	if inverted {
		return !result
	}
	return result
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil {
			return 0
		}
		return f
	case json.Number:
		f, err := val.Float64()
		if err != nil {
			return 0
		}
		return f
	default:
		return 0
	}
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "1"
	case float64:
		return val != 0
	case int:
		return val != 0
	default:
		return false
	}
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05Z", s)
		if err != nil {
			t, err = time.Parse("2006-01-02", s)
			if err != nil {
				return time.Time{}
			}
		}
	}
	return t
}

func compareSemver(a, b string) int {
	aParts := parseSemver(a)
	bParts := parseSemver(b)
	maxLen := len(aParts)
	if len(bParts) > maxLen {
		maxLen = len(bParts)
	}

	for i := 0; i < maxLen; i++ {
		aVal := 0
		bVal := 0
		if i < len(aParts) {
			aVal = aParts[i]
		}
		if i < len(bParts) {
			bVal = bParts[i]
		}
		if aVal < bVal {
			return -1
		}
		if aVal > bVal {
			return 1
		}
	}
	return 0
}

func parseSemver(v string) []int {
	v = strings.TrimPrefix(v, "v")
	parts := strings.Split(v, ".")
	result := make([]int, len(parts))
	for i, p := range parts {
		n, _ := strconv.Atoi(p)
		result[i] = n
	}
	return result
}

func toStringSlice(v interface{}) []string {
	switch val := v.(type) {
	case []string:
		return val
	case []interface{}:
		result := make([]string, len(val))
		for i, item := range val {
			result[i] = fmt.Sprintf("%v", item)
		}
		return result
	default:
		return nil
	}
}

func toLowerSlice(s []string) []string {
	result := make([]string, len(s))
	for i, v := range s {
		result[i] = strings.ToLower(v)
	}
	return result
}

func containsString(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func anyInSlice(targets, arr []string) bool {
	for _, t := range targets {
		for _, a := range arr {
			if t == a {
				return true
			}
		}
	}
	return false
}

func allInSlice(targets, arr []string) bool {
	for _, t := range targets {
		found := false
		for _, a := range arr {
			if t == a {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// Ensure math is used
var _ = math.MaxFloat64
