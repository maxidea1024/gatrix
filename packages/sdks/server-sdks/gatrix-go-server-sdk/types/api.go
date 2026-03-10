package types

import "encoding/json"

// ApiResponse is the standard API response wrapper
type ApiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *ApiError       `json:"error,omitempty"`
	Meta    *ApiMeta        `json:"meta,omitempty"`
}

// ApiError represents an API error
type ApiError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ApiMeta represents API response metadata
type ApiMeta struct {
	Timestamp  string `json:"timestamp"`
	APIVersion string `json:"apiVersion"`
}

// --- Game World ---

type GameWorld struct {
	ID                    string                 `json:"id"`
	WorldID               string                 `json:"worldId"`
	Name                  string                 `json:"name"`
	IsMaintenance         bool                   `json:"isMaintenance"`
	MaintenanceMessage    string                 `json:"maintenanceMessage,omitempty"`
	MaintenanceStartDate  *string                `json:"maintenanceStartDate,omitempty"`
	MaintenanceEndDate    *string                `json:"maintenanceEndDate,omitempty"`
	SupportsMultiLanguage *bool                  `json:"supportsMultiLanguage,omitempty"`
	MaintenanceLocales    []MaintenanceLocale    `json:"maintenanceLocales,omitempty"`
	ForceDisconnect       *bool                  `json:"forceDisconnect,omitempty"`
	GracePeriodMinutes    *int                   `json:"gracePeriodMinutes,omitempty"`
	DisplayOrder          int                    `json:"displayOrder"`
	CustomPayload         map[string]interface{} `json:"customPayload,omitempty"`
	InfraSettings         map[string]interface{} `json:"infraSettings,omitempty"`
	WorldServerAddress    string                 `json:"worldServerAddress"`
	Tags                  []string               `json:"tags,omitempty"`
	CreatedAt             string                 `json:"createdAt,omitempty"`
}

type MaintenanceLocale struct {
	Lang    string `json:"lang"`
	Message string `json:"message"`
}

type GameWorldListResponse struct {
	Worlds []GameWorld `json:"worlds"`
}

// --- Popup Notice ---

type PopupNotice struct {
	ID                       string   `json:"id"`
	Content                  string   `json:"content"`
	TargetWorlds             []string `json:"targetWorlds"`
	TargetWorldsInverted     *bool    `json:"targetWorldsInverted,omitempty"`
	TargetPlatforms          []string `json:"targetPlatforms"`
	TargetPlatformsInverted  *bool    `json:"targetPlatformsInverted,omitempty"`
	TargetChannels           []string `json:"targetChannels"`
	TargetChannelsInverted   *bool    `json:"targetChannelsInverted,omitempty"`
	TargetSubchannels        []string `json:"targetSubchannels"`
	TargetSubchannelsInverted *bool   `json:"targetSubchannelsInverted,omitempty"`
	TargetUserIDs            []string `json:"targetUserIds"`
	TargetUserIDsInverted    *bool    `json:"targetUserIdsInverted,omitempty"`
	DisplayPriority          int      `json:"displayPriority"`
	ShowOnce                 bool     `json:"showOnce"`
	StartDate                *string  `json:"startDate,omitempty"`
	EndDate                  *string  `json:"endDate,omitempty"`
}

// --- Survey ---

type TriggerCondition struct {
	Type  string `json:"type"`
	Value int    `json:"value"`
}

type Reward struct {
	Type     int    `json:"type"`
	ID       string `json:"id"`
	Quantity int    `json:"quantity"`
}

type Survey struct {
	ID                        string             `json:"id"`
	PlatformSurveyID          string             `json:"platformSurveyId"`
	SurveyTitle               string             `json:"surveyTitle"`
	SurveyContent             string             `json:"surveyContent,omitempty"`
	TriggerConditions         []TriggerCondition `json:"triggerConditions"`
	ParticipationRewards      []Reward           `json:"participationRewards,omitempty"`
	RewardMailTitle           string             `json:"rewardMailTitle,omitempty"`
	RewardMailContent         string             `json:"rewardMailContent,omitempty"`
	TargetPlatforms           []string           `json:"targetPlatforms,omitempty"`
	TargetPlatformsInverted   *bool              `json:"targetPlatformsInverted,omitempty"`
	TargetChannels            []string           `json:"targetChannels,omitempty"`
	TargetChannelsInverted    *bool              `json:"targetChannelsInverted,omitempty"`
	TargetSubchannels         []string           `json:"targetSubchannels,omitempty"`
	TargetSubchannelsInverted *bool              `json:"targetSubchannelsInverted,omitempty"`
	TargetWorlds              []string           `json:"targetWorlds,omitempty"`
	TargetWorldsInverted      *bool              `json:"targetWorldsInverted,omitempty"`
}

type SurveySettings struct {
	DefaultSurveyURL string `json:"defaultSurveyUrl"`
	CompletionURL    string `json:"completionUrl"`
	LinkCaption      string `json:"linkCaption"`
	VerificationKey  string `json:"verificationKey"`
}

type SurveyListResponse struct {
	Surveys  []Survey        `json:"surveys"`
	Settings *SurveySettings `json:"settings,omitempty"`
}

// --- Whitelist ---

type WhitelistData struct {
	IPWhitelist      IPWhitelist      `json:"ipWhitelist"`
	AccountWhitelist AccountWhitelist `json:"accountWhitelist"`
}

type IPWhitelist struct {
	Enabled bool     `json:"enabled"`
	IPs     []string `json:"ips"`
}

type AccountWhitelist struct {
	Enabled    bool     `json:"enabled"`
	AccountIDs []string `json:"accountIds"`
}

// --- Maintenance ---

type MaintenanceDetail struct {
	Type               string                     `json:"type"`
	StartsAt           *string                    `json:"startsAt"`
	EndsAt             *string                    `json:"endsAt"`
	Message            string                     `json:"message"`
	LocaleMessages     map[string]string          `json:"localeMessages,omitempty"`
	KickExistingPlayers *bool                     `json:"kickExistingPlayers,omitempty"`
	KickDelayMinutes   *int                       `json:"kickDelayMinutes,omitempty"`
}

type MaintenanceStatus struct {
	HasMaintenanceScheduled bool               `json:"hasMaintenanceScheduled"`
	IsMaintenanceActive     bool               `json:"isMaintenanceActive"`
	IsUnderMaintenance      bool               `json:"isUnderMaintenance"` // Deprecated
	Detail                  *MaintenanceDetail `json:"detail"`
}

// --- Store Product ---

type StoreProduct struct {
	ID            string                 `json:"id"`
	CmsProductID  int                    `json:"cmsProductId"`
	ProductID     string                 `json:"productId"`
	ProductName   string                 `json:"productName"`
	Store         string                 `json:"store"`
	Price         float64                `json:"price"`
	Currency      string                 `json:"currency"`
	SaleStartAt   *string                `json:"saleStartAt"`
	SaleEndAt     *string                `json:"saleEndAt"`
	Description   *string                `json:"description"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	CreatedAt     string                 `json:"createdAt,omitempty"`
	UpdatedAt     string                 `json:"updatedAt,omitempty"`
}

type StoreProductListResponse struct {
	Products []StoreProduct `json:"products"`
	Total    int            `json:"total"`
}

// --- Coupon ---

type RedeemCouponRequest struct {
	Code        string `json:"code"`
	UserID      string `json:"userId"`
	UserName    string `json:"userName"`
	CharacterID string `json:"characterId"`
	WorldID     string `json:"worldId"`
	Platform    string `json:"platform"`
	Channel     string `json:"channel"`
	SubChannel  string `json:"subChannel"`
}

type RedeemCouponResponse struct {
	Reward           []Reward `json:"reward"`
	UserUsedCount    int      `json:"userUsedCount"`
	GlobalUsed       int      `json:"globalUsed"`
	Sequence         int      `json:"sequence"`
	UsedAt           string   `json:"usedAt"`
	RewardMailTitle  string   `json:"rewardMailTitle"`
	RewardMailContent string  `json:"rewardMailContent"`
}

// --- Service Discovery ---

type ServiceStatus string

const (
	ServiceStatusInitializing ServiceStatus = "initializing"
	ServiceStatusReady        ServiceStatus = "ready"
	ServiceStatusShuttingDown ServiceStatus = "shutting_down"
	ServiceStatusError        ServiceStatus = "error"
	ServiceStatusTerminated   ServiceStatus = "terminated"
	ServiceStatusNoResponse   ServiceStatus = "no-response"
	ServiceStatusHeartbeat    ServiceStatus = "heartbeat"
)

type ServicePorts map[string]int

type ServiceLabels struct {
	Service     string            `json:"service"`
	Group       string            `json:"group,omitempty"`
	Environment string            `json:"environment,omitempty"`
	Region      string            `json:"region,omitempty"`
	Extra       map[string]string `json:"-"` // Additional custom labels
}

type ServiceInstance struct {
	InstanceID      string                 `json:"instanceId"`
	Labels          ServiceLabels          `json:"labels"`
	Hostname        string                 `json:"hostname"`
	ExternalAddress string                 `json:"externalAddress"`
	InternalAddress string                 `json:"internalAddress"`
	Ports           ServicePorts           `json:"ports"`
	Status          ServiceStatus          `json:"status"`
	Stats           map[string]interface{} `json:"stats,omitempty"`
	Meta            map[string]interface{} `json:"meta,omitempty"`
	UpdatedAt       string                 `json:"updatedAt"`
}

type RegisterServiceInput struct {
	InstanceID      string                 `json:"instanceId,omitempty"`
	Labels          ServiceLabels          `json:"labels"`
	Hostname        string                 `json:"hostname,omitempty"`
	InternalAddress string                 `json:"internalAddress,omitempty"`
	Ports           ServicePorts           `json:"ports"`
	Status          ServiceStatus          `json:"status,omitempty"`
	Stats           map[string]interface{} `json:"stats,omitempty"`
	Meta            map[string]interface{} `json:"meta,omitempty"`
}

type UpdateServiceStatusInput struct {
	Status               ServiceStatus          `json:"status,omitempty"`
	Stats                map[string]interface{} `json:"stats,omitempty"`
	AutoRegisterIfMissing bool                  `json:"autoRegisterIfMissing,omitempty"`
	Hostname             string                 `json:"hostname,omitempty"`
	InternalAddress      string                 `json:"internalAddress,omitempty"`
	Ports                ServicePorts           `json:"ports,omitempty"`
	Meta                 map[string]interface{} `json:"meta,omitempty"`
}

type GetServicesParams struct {
	Service     string            `json:"service,omitempty"`
	Group       string            `json:"group,omitempty"`
	Environment string            `json:"environment,omitempty"`
	Region      string            `json:"region,omitempty"`
	Status      ServiceStatus     `json:"status,omitempty"`
	ExcludeSelf *bool             `json:"excludeSelf,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
}

type RegisterServiceResponse struct {
	InstanceID      string  `json:"instanceId"`
	Hostname        string  `json:"hostname"`
	InternalAddress string  `json:"internalAddress"`
	ExternalAddress string  `json:"externalAddress"`
	OrgID           *string `json:"orgId"`
	ProjectID       *string `json:"projectId"`
	EnvironmentID   *string `json:"environmentId"`
}
