package types

// StandardEventType is a known SDK event type
type StandardEventType string

const (
	EventGameWorldCreated      StandardEventType = "game_world.created"
	EventGameWorldUpdated      StandardEventType = "game_world.updated"
	EventGameWorldDeleted      StandardEventType = "game_world.deleted"
	EventGameWorldOrderChanged StandardEventType = "game_world.order_changed"
	EventPopupCreated          StandardEventType = "popup.created"
	EventPopupUpdated          StandardEventType = "popup.updated"
	EventPopupDeleted          StandardEventType = "popup.deleted"
	EventSurveyCreated         StandardEventType = "survey.created"
	EventSurveyUpdated         StandardEventType = "survey.updated"
	EventSurveyDeleted         StandardEventType = "survey.deleted"
	EventSurveySettingsUpdated StandardEventType = "survey.settings.updated"
	EventMaintenanceUpdated    StandardEventType = "maintenance.settings.updated"
	EventWhitelistUpdated      StandardEventType = "whitelist.updated"
	EventStoreProductCreated   StandardEventType = "store_product.created"
	EventStoreProductUpdated   StandardEventType = "store_product.updated"
	EventStoreProductDeleted   StandardEventType = "store_product.deleted"
	EventStoreProductBulk      StandardEventType = "store_product.bulk_updated"
	EventFeatureFlagChanged    StandardEventType = "feature_flag.changed"
	EventFeatureFlagCreated    StandardEventType = "feature_flag.created"
	EventFeatureFlagUpdated    StandardEventType = "feature_flag.updated"
	EventFeatureFlagDeleted    StandardEventType = "feature_flag.deleted"
	EventSegmentCreated        StandardEventType = "segment.created"
	EventSegmentUpdated        StandardEventType = "segment.updated"
	EventSegmentDeleted        StandardEventType = "segment.deleted"
)

// StandardEventData holds data for standard events
type StandardEventData struct {
	ID                   interface{}         `json:"id,omitempty"`
	Timestamp            int64               `json:"timestamp"`
	EnvironmentID        string              `json:"environmentId,omitempty"`
	IsVisible            interface{}         `json:"isVisible,omitempty"` // bool or 0/1
	IsActive             interface{}         `json:"isActive,omitempty"`  // bool or 0/1
	Status               string              `json:"status,omitempty"`
	IsMaintenance        *bool               `json:"isMaintenance,omitempty"`
	Count                *int                `json:"count,omitempty"`
	SegmentName          string              `json:"segmentName,omitempty"`
	Segment              interface{}         `json:"segment,omitempty"`
	ProjectID            string              `json:"projectId,omitempty"`
	ChangedKeys          []string            `json:"changedKeys,omitempty"`
	ChangeType           string              `json:"changeType,omitempty"`
	MaintenanceStartDate string              `json:"maintenanceStartDate,omitempty"`
	MaintenanceEndDate   string              `json:"maintenanceEndDate,omitempty"`
	MaintenanceMessage   string              `json:"maintenanceMessage,omitempty"`
	MaintenanceLocales   []MaintenanceLocale `json:"maintenanceLocales,omitempty"`
}

// StandardEvent is a Redis Pub/Sub event
type StandardEvent struct {
	Type string            `json:"type"`
	Data StandardEventData `json:"data"`
}

// SdkEvent is the event passed to user callbacks
type SdkEvent struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp string      `json:"timestamp"`
}

// EventCallback is a function that handles SDK events
type EventCallback func(event SdkEvent)

// ToBool converts the isVisible/isActive interface value to bool
func ToBool(v interface{}) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case float64:
		return val != 0
	case int:
		return val != 0
	default:
		return false
	}
}
