package services

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// --- Survey Service ---

type SurveyService struct {
	*BaseEnvironmentService
	settings map[string]*types.SurveySettings
}

func NewSurveyService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *SurveyService {
	return &SurveyService{
		BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID),
		settings:               make(map[string]*types.SurveySettings),
	}
}

func (s *SurveyService) FetchByEnvironment(environmentID string) ([]types.Survey, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/surveys", environmentID)
	if err != nil {
		return nil, err
	}
	var resp types.SurveyListResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	envID := s.ResolveEnvironment(environmentID)
	s.mu.Lock()
	s.settings[envID] = resp.Settings
	s.mu.Unlock()
	return resp.Surveys, nil
}

func (s *SurveyService) GetAll(environmentID string) []types.Survey {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var resp types.SurveyListResponse
	_ = json.Unmarshal(raw, &resp)
	return resp.Surveys
}

func (s *SurveyService) GetSettings(environmentID string) *types.SurveySettings {
	envID := s.ResolveEnvironment(environmentID)
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings[envID]
}

// --- Whitelist Service ---

type WhitelistService struct {
	*BaseEnvironmentService
}

func NewWhitelistService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *WhitelistService {
	return &WhitelistService{BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID)}
}

func (s *WhitelistService) FetchByEnvironment(environmentID string) (*types.WhitelistData, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/whitelist", environmentID)
	if err != nil {
		return nil, err
	}
	var wl types.WhitelistData
	if err := json.Unmarshal(data, &wl); err != nil {
		return nil, err
	}
	return &wl, nil
}

func (s *WhitelistService) Get(environmentID string) *types.WhitelistData {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var wl types.WhitelistData
	_ = json.Unmarshal(raw, &wl)
	return &wl
}

func (s *WhitelistService) IsIPWhitelisted(ip, environmentID string) bool {
	wl := s.Get(environmentID)
	if wl == nil || !wl.IPWhitelist.Enabled {
		return false
	}
	for _, wlIP := range wl.IPWhitelist.IPs {
		if wlIP == ip {
			return true
		}
	}
	return false
}

func (s *WhitelistService) IsAccountWhitelisted(accountID, environmentID string) bool {
	wl := s.Get(environmentID)
	if wl == nil || !wl.AccountWhitelist.Enabled {
		return false
	}
	for _, id := range wl.AccountWhitelist.AccountIDs {
		if id == accountID {
			return true
		}
	}
	return false
}

// --- Service Maintenance Service ---

type ServiceMaintenanceService struct {
	*BaseEnvironmentService
}

func NewServiceMaintenanceService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *ServiceMaintenanceService {
	return &ServiceMaintenanceService{BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID)}
}

func (s *ServiceMaintenanceService) FetchByEnvironment(environmentID string) (*types.MaintenanceStatus, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/maintenance", environmentID)
	if err != nil {
		return nil, err
	}
	var status types.MaintenanceStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

func (s *ServiceMaintenanceService) GetStatus(environmentID string) *types.MaintenanceStatus {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var status types.MaintenanceStatus
	_ = json.Unmarshal(raw, &status)
	return &status
}

func (s *ServiceMaintenanceService) IsActive(environmentID string) bool {
	status := s.GetStatus(environmentID)
	if status == nil || !status.HasMaintenanceScheduled {
		return false
	}
	if status.Detail == nil {
		return false
	}
	now := time.Now().UTC()
	if status.Detail.StartsAt != nil {
		start, err := time.Parse(time.RFC3339, *status.Detail.StartsAt)
		if err == nil && now.Before(start) {
			return false
		}
	}
	if status.Detail.EndsAt != nil {
		end, err := time.Parse(time.RFC3339, *status.Detail.EndsAt)
		if err == nil && now.After(end) {
			return false
		}
	}
	return true
}

func (s *ServiceMaintenanceService) GetMessage(environmentID, lang string) string {
	status := s.GetStatus(environmentID)
	if status == nil || status.Detail == nil || !s.IsActive(environmentID) {
		return ""
	}
	if status.Detail.LocaleMessages != nil {
		if msg, ok := status.Detail.LocaleMessages[lang]; ok && msg != "" {
			return msg
		}
	}
	return status.Detail.Message
}

// --- Store Product Service ---

type StoreProductService struct {
	*BaseEnvironmentService
}

func NewStoreProductService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *StoreProductService {
	return &StoreProductService{BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID)}
}

func (s *StoreProductService) FetchByEnvironment(environmentID string) ([]types.StoreProduct, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/store-products", environmentID)
	if err != nil {
		return nil, err
	}
	var resp types.StoreProductListResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Products, nil
}

func (s *StoreProductService) GetAll(environmentID string) []types.StoreProduct {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var resp types.StoreProductListResponse
	_ = json.Unmarshal(raw, &resp)
	return resp.Products
}

// --- Service Discovery Service ---

type ServiceDiscoveryService struct {
	apiClient  *client.ApiClient
	logger     types.Logger
	instanceID string
	labels     *types.ServiceLabels
}

func NewServiceDiscoveryService(apiClient *client.ApiClient, logger types.Logger) *ServiceDiscoveryService {
	return &ServiceDiscoveryService{apiClient: apiClient, logger: logger}
}

func (s *ServiceDiscoveryService) Register(input types.RegisterServiceInput) (*types.RegisterServiceResponse, error) {
	if input.Hostname == "" {
		hostname, _ := os.Hostname()
		input.Hostname = hostname
	}
	resp, err := s.apiClient.Post("/api/v1/server/services/register", input)
	if err != nil {
		return nil, err
	}
	if !resp.Success || resp.Data == nil {
		errMsg := "Failed to register service"
		if resp.Error != nil {
			errMsg = resp.Error.Message
		}
		return nil, fmt.Errorf(errMsg)
	}
	var result types.RegisterServiceResponse
	if err := json.Unmarshal(resp.Data, &result); err != nil {
		return nil, err
	}
	s.instanceID = result.InstanceID
	s.labels = &input.Labels
	s.logger.Info("Service registered", map[string]interface{}{"instanceId": s.instanceID})
	return &result, nil
}

func (s *ServiceDiscoveryService) Unregister() error {
	if s.instanceID == "" {
		return nil
	}
	_, err := s.apiClient.PostNoRetry("/api/v1/server/services/unregister", map[string]interface{}{
		"instanceId": s.instanceID, "labels": s.labels,
	})
	s.instanceID = ""
	s.labels = nil
	return err
}

func (s *ServiceDiscoveryService) UpdateStatus(input types.UpdateServiceStatusInput) error {
	if s.instanceID == "" {
		return nil
	}
	payload := map[string]interface{}{
		"instanceId": s.instanceID, "labels": s.labels, "status": input.Status, "stats": input.Stats,
	}
	_, err := s.apiClient.Post("/api/v1/server/services/status", payload)
	return err
}

func (s *ServiceDiscoveryService) FetchServices(params *types.GetServicesParams) ([]types.ServiceInstance, error) {
	queryPath := "/api/v1/server/services"
	if params != nil {
		q := url.Values{}
		if params.Service != "" {
			q.Set("serviceType", params.Service)
		}
		if params.Group != "" {
			q.Set("group", params.Group)
		}
		if params.Environment != "" {
			q.Set("environment", params.Environment)
		}
		if params.Status != "" {
			q.Set("status", string(params.Status))
		}
		if qs := q.Encode(); qs != "" {
			queryPath += "?" + qs
		}
	}
	resp, err := s.apiClient.Get(queryPath)
	if err != nil {
		return nil, err
	}
	if !resp.Success || resp.Data == nil {
		return nil, fmt.Errorf("failed to fetch services")
	}
	var services []types.ServiceInstance
	if err := json.Unmarshal(resp.Data, &services); err != nil {
		return nil, err
	}
	return services, nil
}

func (s *ServiceDiscoveryService) GetInstanceID() string { return s.instanceID }

// --- Coupon Service ---

type CouponService struct {
	apiClient *client.ApiClient
	logger    types.Logger
}

func NewCouponService(apiClient *client.ApiClient, logger types.Logger) *CouponService {
	return &CouponService{apiClient: apiClient, logger: logger}
}

func (s *CouponService) Redeem(request types.RedeemCouponRequest, environmentID string) (*types.RedeemCouponResponse, error) {
	code := request.Code
	body := map[string]interface{}{
		"userId": request.UserID, "userName": request.UserName,
		"characterId": request.CharacterID, "worldId": request.WorldID,
		"platform": request.Platform, "channel": request.Channel, "subChannel": request.SubChannel,
	}

	resp, err := s.apiClient.Post(fmt.Sprintf("/api/v1/server/coupons/%s/redeem", url.PathEscape(code)), body)
	if err != nil {
		if gatrixErr, ok := err.(*types.GatrixError); ok {
			return nil, &types.CouponRedeemError{
				Code: types.CouponCodeNotFound, Message: gatrixErr.Message, StatusCode: gatrixErr.StatusCode,
			}
		}
		return nil, err
	}
	if !resp.Success || resp.Data == nil {
		errCode := types.CouponCodeNotFound
		errMsg := "Failed to redeem coupon"
		if resp.Error != nil {
			errMsg = resp.Error.Message
			errCode = types.CouponRedeemErrorCode(resp.Error.Code)
		}
		return nil, &types.CouponRedeemError{Code: errCode, Message: errMsg, StatusCode: 400}
	}
	var result types.RedeemCouponResponse
	if err := json.Unmarshal(resp.Data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
