package services

import (
	"encoding/json"
	"sync"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// BaseEnvironmentService provides common caching logic for per-environment data
type BaseEnvironmentService struct {
	apiClient            *client.ApiClient
	logger               types.Logger
	defaultEnvironmentID string
	cachedByEnv          map[string]json.RawMessage
	mu                   sync.RWMutex
	featureEnabled       bool
}

func NewBaseEnvironmentService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *BaseEnvironmentService {
	return &BaseEnvironmentService{
		apiClient:            apiClient,
		logger:               logger,
		defaultEnvironmentID: defaultEnvID,
		cachedByEnv:          make(map[string]json.RawMessage),
		featureEnabled:       true,
	}
}

func (s *BaseEnvironmentService) ResolveEnvironment(environmentID string) string {
	if environmentID != "" {
		return environmentID
	}
	return s.defaultEnvironmentID
}

func (s *BaseEnvironmentService) SetFeatureEnabled(enabled bool) { s.featureEnabled = enabled }
func (s *BaseEnvironmentService) IsFeatureEnabled() bool        { return s.featureEnabled }

func (s *BaseEnvironmentService) FetchAndCache(endpoint string, environmentID string) (json.RawMessage, error) {
	envID := s.ResolveEnvironment(environmentID)
	resp, err := s.apiClient.Get(endpoint)
	if err != nil {
		return nil, err
	}
	if !resp.Success || resp.Data == nil {
		errMsg := "unknown error"
		if resp.Error != nil {
			errMsg = resp.Error.Message
		}
		s.mu.RLock()
		if cached, ok := s.cachedByEnv[envID]; ok {
			s.mu.RUnlock()
			return cached, nil
		}
		s.mu.RUnlock()
		return nil, &types.GatrixError{Code: types.ErrorCodeAPIError, Message: errMsg}
	}
	s.mu.Lock()
	s.cachedByEnv[envID] = resp.Data
	s.mu.Unlock()
	return resp.Data, nil
}

func (s *BaseEnvironmentService) GetCachedRaw(environmentID string) json.RawMessage {
	envID := s.ResolveEnvironment(environmentID)
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cachedByEnv[envID]
}

func (s *BaseEnvironmentService) SetCachedRaw(environmentID string, data json.RawMessage) {
	envID := s.ResolveEnvironment(environmentID)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cachedByEnv[envID] = data
}

func (s *BaseEnvironmentService) ClearCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cachedByEnv = make(map[string]json.RawMessage)
}

func (s *BaseEnvironmentService) ClearCacheForEnvironment(environmentID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.cachedByEnv, environmentID)
}
