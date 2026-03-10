package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/evaluator"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// FeatureFlagService handles feature flag evaluation with local caching
type FeatureFlagService struct {
	apiClient            *client.ApiClient
	logger               types.Logger
	defaultEnvironmentID string
	cachedFlagsByEnv     map[string]map[string]types.FeatureFlag
	cachedSegments       map[string]map[string]types.FeatureSegment
	envToProjectMap      map[string]string
	metricsBuffer        []types.FlagMetric
	bucketStartTime      time.Time
	metricsFlushInterval *time.Ticker
	metricsStopChan      chan struct{}
	staticContext        types.EvaluationContext
	featureEnabled       bool
	compactFlags         bool
	mu                   sync.RWMutex
	metricsMu            sync.Mutex
}

func NewFeatureFlagService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *FeatureFlagService {
	return &FeatureFlagService{
		apiClient:            apiClient,
		logger:               logger,
		defaultEnvironmentID: defaultEnvID,
		cachedFlagsByEnv:     make(map[string]map[string]types.FeatureFlag),
		cachedSegments:       make(map[string]map[string]types.FeatureSegment),
		envToProjectMap:      make(map[string]string),
		metricsBuffer:        make([]types.FlagMetric, 0),
		bucketStartTime:      time.Now().UTC(),
		featureEnabled:       true,
		compactFlags:         true,
	}
}

func (s *FeatureFlagService) SetFeatureEnabled(enabled bool) { s.featureEnabled = enabled }
func (s *FeatureFlagService) SetCompactFlags(enabled bool)   { s.compactFlags = enabled }

func (s *FeatureFlagService) SetStaticContext(ctx types.EvaluationContext) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.staticContext = ctx
}

func (s *FeatureFlagService) resolveEnv(environmentID string) string {
	if environmentID != "" {
		return environmentID
	}
	return s.defaultEnvironmentID
}

func (s *FeatureFlagService) mergeContext(ctx types.EvaluationContext) types.EvaluationContext {
	merged := types.EvaluationContext{
		UserID:        s.staticContext.UserID,
		SessionID:     s.staticContext.SessionID,
		AppName:       s.staticContext.AppName,
		AppVersion:    s.staticContext.AppVersion,
		RemoteAddress: s.staticContext.RemoteAddress,
		Properties:    make(map[string]interface{}),
	}
	for k, v := range s.staticContext.Properties {
		merged.Properties[k] = v
	}
	if ctx.UserID != "" {
		merged.UserID = ctx.UserID
	}
	if ctx.SessionID != "" {
		merged.SessionID = ctx.SessionID
	}
	if ctx.AppName != "" {
		merged.AppName = ctx.AppName
	}
	if ctx.AppVersion != "" {
		merged.AppVersion = ctx.AppVersion
	}
	if ctx.RemoteAddress != "" {
		merged.RemoteAddress = ctx.RemoteAddress
	}
	for k, v := range ctx.Properties {
		merged.Properties[k] = v
	}
	return merged
}

func (s *FeatureFlagService) FetchByEnvironment(environmentID string) ([]types.FeatureFlag, error) {
	envID := s.resolveEnv(environmentID)
	endpoint := "/api/v1/server/features"
	if s.compactFlags {
		endpoint += "?compact=true"
	}
	resp, err := s.apiClient.Get(endpoint)
	if err != nil {
		return nil, err
	}
	if !resp.Success || resp.Data == nil {
		errMsg := "Failed to fetch feature flags"
		if resp.Error != nil {
			errMsg = resp.Error.Message
		}
		return nil, fmt.Errorf(errMsg)
	}
	var apiResp types.FeatureFlagsAPIResponse
	if err := json.Unmarshal(resp.Data, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse feature flags response: %w", err)
	}

	s.mu.Lock()
	flagMap := make(map[string]types.FeatureFlag)
	for _, flag := range apiResp.Flags {
		flagMap[flag.Name] = flag
	}
	s.cachedFlagsByEnv[envID] = flagMap
	if apiResp.ProjectID != "" {
		s.envToProjectMap[envID] = apiResp.ProjectID
		segMap := make(map[string]types.FeatureSegment)
		for _, seg := range apiResp.Segments {
			segMap[seg.Name] = seg
		}
		s.cachedSegments[apiResp.ProjectID] = segMap
	}
	s.mu.Unlock()

	s.logger.Info("Feature flags fetched", map[string]interface{}{
		"count": len(apiResp.Flags), "envId": envID, "projectId": apiResp.ProjectID,
	})
	return apiResp.Flags, nil
}

func (s *FeatureFlagService) RefreshByEnvironment(environmentID string) ([]types.FeatureFlag, error) {
	s.apiClient.InvalidateEtagCache("/api/v1/server/features")
	return s.FetchByEnvironment(environmentID)
}

func (s *FeatureFlagService) GetCached(environmentID string) []types.FeatureFlag {
	envID := s.resolveEnv(environmentID)
	s.mu.RLock()
	defer s.mu.RUnlock()
	flagMap, ok := s.cachedFlagsByEnv[envID]
	if !ok {
		return nil
	}
	flags := make([]types.FeatureFlag, 0, len(flagMap))
	for _, f := range flagMap {
		flags = append(flags, f)
	}
	return flags
}

func (s *FeatureFlagService) ClearCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cachedFlagsByEnv = make(map[string]map[string]types.FeatureFlag)
}

func (s *FeatureFlagService) UpdateSegmentInCache(segment types.FeatureSegment, projectID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if projectID != "" {
		if s.cachedSegments[projectID] == nil {
			s.cachedSegments[projectID] = make(map[string]types.FeatureSegment)
		}
		s.cachedSegments[projectID][segment.Name] = segment
	}
}

func (s *FeatureFlagService) RemoveSegmentFromCache(segmentName, projectID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if projectID != "" {
		if segMap, ok := s.cachedSegments[projectID]; ok {
			delete(segMap, segmentName)
		}
	}
}

func (s *FeatureFlagService) GetProjectIDForEnvironment(environmentID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.envToProjectMap[environmentID]
}

func (s *FeatureFlagService) Evaluate(flagName string, ctx *types.EvaluationContext, environmentID string) types.EvaluationResult {
	envID := s.resolveEnv(environmentID)
	mergedCtx := types.EvaluationContext{}
	if ctx != nil {
		mergedCtx = s.mergeContext(*ctx)
	}

	s.mu.RLock()
	flagMap := s.cachedFlagsByEnv[envID]
	flag, found := flagMap[flagName]
	var segments map[string]types.FeatureSegment
	if projectID, ok := s.envToProjectMap[envID]; ok {
		segments = s.cachedSegments[projectID]
	}
	s.mu.RUnlock()

	if !found {
		return types.EvaluationResult{
			FlagName: flagName, Enabled: false, Reason: types.ReasonNotFound,
			Variant: &types.Variant{Name: types.ValueSourceMissing, Weight: 100, Enabled: false},
		}
	}
	if segments == nil {
		segments = make(map[string]types.FeatureSegment)
	}

	result := evaluator.Evaluate(flag, mergedCtx, segments)
	variantName := ""
	if result.Variant != nil {
		variantName = result.Variant.Name
	}
	s.recordMetric(envID, flagName, result.Enabled, variantName)
	return result
}

func (s *FeatureFlagService) IsEnabled(flagName string, fallback bool, ctx *types.EvaluationContext, environmentID string) bool {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound {
		return fallback
	}
	return result.Enabled
}

func (s *FeatureFlagService) StringVariation(flagName, fallback string, ctx *types.EvaluationContext, environmentID string) string {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil || result.Variant.Value == nil {
		return fallback
	}
	return fmt.Sprintf("%v", result.Variant.Value)
}

func (s *FeatureFlagService) IntVariation(flagName string, fallback int, ctx *types.EvaluationContext, environmentID string) int {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil || result.Variant.Value == nil {
		return fallback
	}
	switch v := result.Variant.Value.(type) {
	case float64:
		return int(v)
	case string:
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func (s *FeatureFlagService) FloatVariation(flagName string, fallback float64, ctx *types.EvaluationContext, environmentID string) float64 {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil || result.Variant.Value == nil {
		return fallback
	}
	switch v := result.Variant.Value.(type) {
	case float64:
		return v
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func (s *FeatureFlagService) BoolVariation(flagName string, fallback bool, ctx *types.EvaluationContext, environmentID string) bool {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil || result.Variant.Value == nil {
		return fallback
	}
	switch v := result.Variant.Value.(type) {
	case bool:
		return v
	case string:
		return v == "true" || v == "1"
	case float64:
		return v != 0
	}
	return fallback
}

func (s *FeatureFlagService) JsonVariation(flagName string, fallback interface{}, ctx *types.EvaluationContext, environmentID string) interface{} {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil || result.Variant.Value == nil {
		return fallback
	}
	v := result.Variant.Value
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	if str, ok := v.(string); ok {
		var parsed interface{}
		if err := json.Unmarshal([]byte(str), &parsed); err == nil {
			return parsed
		}
	}
	return fallback
}

func (s *FeatureFlagService) Variation(flagName, fallback string, ctx *types.EvaluationContext, environmentID string) string {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound || result.Variant == nil {
		return fallback
	}
	return result.Variant.Name
}

func (s *FeatureFlagService) StringVariationDetails(flagName, fallback string, ctx *types.EvaluationContext, environmentID string) types.EvaluationDetail[string] {
	result := s.Evaluate(flagName, ctx, environmentID)
	value := fallback
	variantName := ""
	if result.Reason != types.ReasonNotFound && result.Variant != nil && result.Variant.Value != nil {
		value = fmt.Sprintf("%v", result.Variant.Value)
		variantName = result.Variant.Name
	}
	return types.EvaluationDetail[string]{Value: value, Reason: result.Reason, FlagName: flagName, VariantName: variantName}
}

func (s *FeatureFlagService) IntVariationDetails(flagName string, fallback int, ctx *types.EvaluationContext, environmentID string) types.EvaluationDetail[int] {
	result := s.Evaluate(flagName, ctx, environmentID)
	value := fallback
	variantName := ""
	if result.Reason != types.ReasonNotFound && result.Variant != nil && result.Variant.Value != nil {
		variantName = result.Variant.Name
		switch v := result.Variant.Value.(type) {
		case float64:
			value = int(v)
		case string:
			if n, err := strconv.Atoi(v); err == nil {
				value = n
			}
		}
	}
	return types.EvaluationDetail[int]{Value: value, Reason: result.Reason, FlagName: flagName, VariantName: variantName}
}

func (s *FeatureFlagService) StringVariationOrThrow(flagName string, ctx *types.EvaluationContext, environmentID string) (string, error) {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound {
		return "", &types.FeatureFlagError{Code: types.FlagNotFound, Message: fmt.Sprintf("Feature flag '%s' not found", flagName), FlagName: flagName, EnvironmentID: environmentID}
	}
	if result.Variant == nil || result.Variant.Value == nil {
		return "", &types.FeatureFlagError{Code: types.FlagNoValue, Message: fmt.Sprintf("Feature flag '%s' has no variant value", flagName), FlagName: flagName, EnvironmentID: environmentID}
	}
	return fmt.Sprintf("%v", result.Variant.Value), nil
}

func (s *FeatureFlagService) IntVariationOrThrow(flagName string, ctx *types.EvaluationContext, environmentID string) (int, error) {
	result := s.Evaluate(flagName, ctx, environmentID)
	if result.Reason == types.ReasonNotFound {
		return 0, &types.FeatureFlagError{Code: types.FlagNotFound, Message: fmt.Sprintf("Feature flag '%s' not found", flagName), FlagName: flagName, EnvironmentID: environmentID}
	}
	if result.Variant == nil || result.Variant.Value == nil {
		return 0, &types.FeatureFlagError{Code: types.FlagNoValue, Message: fmt.Sprintf("Feature flag '%s' has no variant value", flagName), FlagName: flagName, EnvironmentID: environmentID}
	}
	switch v := result.Variant.Value.(type) {
	case float64:
		return int(v), nil
	case string:
		n, err := strconv.Atoi(v)
		if err != nil {
			return 0, &types.FeatureFlagError{Code: types.FlagInvalidType, Message: fmt.Sprintf("Feature flag '%s' value is not a valid integer", flagName), FlagName: flagName, EnvironmentID: environmentID}
		}
		return n, nil
	}
	return 0, &types.FeatureFlagError{Code: types.FlagInvalidType, Message: fmt.Sprintf("Feature flag '%s' value type not supported", flagName), FlagName: flagName, EnvironmentID: environmentID}
}

func (s *FeatureFlagService) recordMetric(envID, flagName string, enabled bool, variantName string) {
	s.metricsMu.Lock()
	defer s.metricsMu.Unlock()
	s.metricsBuffer = append(s.metricsBuffer, types.FlagMetric{
		EnvironmentID: envID, FlagName: flagName, Enabled: enabled, VariantName: variantName,
	})
	if len(s.metricsBuffer) >= 1000 {
		go s.FlushMetrics()
	}
}

func (s *FeatureFlagService) StartMetricsCollection(intervalMs int) {
	if intervalMs <= 0 {
		intervalMs = 60000
	}
	s.metricsFlushInterval = time.NewTicker(time.Duration(intervalMs) * time.Millisecond)
	s.metricsStopChan = make(chan struct{})
	go func() {
		for {
			select {
			case <-s.metricsFlushInterval.C:
				s.FlushMetrics()
			case <-s.metricsStopChan:
				return
			}
		}
	}()
}

func (s *FeatureFlagService) StopMetricsCollection() {
	if s.metricsFlushInterval != nil {
		s.metricsFlushInterval.Stop()
	}
	if s.metricsStopChan != nil {
		close(s.metricsStopChan)
	}
	s.FlushMetrics()
}

func (s *FeatureFlagService) FlushMetrics() {
	s.metricsMu.Lock()
	if len(s.metricsBuffer) == 0 {
		s.metricsMu.Unlock()
		return
	}
	metrics := s.metricsBuffer
	s.metricsBuffer = make([]types.FlagMetric, 0)
	bucketStart := s.bucketStartTime
	s.bucketStartTime = time.Now().UTC()
	s.metricsMu.Unlock()

	type metricKey struct {
		flagName    string
		enabled     bool
		variantName string
	}
	aggregated := make(map[metricKey]int)
	for _, m := range metrics {
		aggregated[metricKey{m.FlagName, m.Enabled, m.VariantName}]++
	}

	aggMetrics := make([]types.AggregatedMetric, 0, len(aggregated))
	for k, count := range aggregated {
		aggMetrics = append(aggMetrics, types.AggregatedMetric{
			FlagName: k.flagName, Enabled: k.enabled, VariantName: k.variantName, Count: count,
		})
	}

	bucketStop := time.Now().UTC()
	payload := types.FlagMetricsPayload{
		Metrics: aggMetrics,
		Bucket: types.MetricsBucket{
			Start: bucketStart.Format(time.RFC3339Nano), Stop: bucketStop.Format(time.RFC3339Nano),
		},
		Timestamp: bucketStop.Format(time.RFC3339Nano), SDKVersion: types.SDKVersion,
	}

	_, err := s.apiClient.Post("/api/v1/server/features/metrics", payload)
	if err != nil {
		s.logger.Error("Failed to flush feature flag metrics", map[string]interface{}{"error": err.Error()})
		s.metricsMu.Lock()
		if len(s.metricsBuffer) < 10000 {
			s.metricsBuffer = append(metrics, s.metricsBuffer...)
		}
		s.metricsMu.Unlock()
	}
}
