package services

import (
	"encoding/json"
	"sort"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// GameWorldService handles game world caching and queries
type GameWorldService struct {
	*BaseEnvironmentService
}

func NewGameWorldService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *GameWorldService {
	return &GameWorldService{BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID)}
}

func (s *GameWorldService) FetchByEnvironment(environmentID string) ([]types.GameWorld, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/game-worlds", environmentID)
	if err != nil {
		return nil, err
	}
	var resp types.GameWorldListResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	sort.Slice(resp.Worlds, func(i, j int) bool { return resp.Worlds[i].DisplayOrder < resp.Worlds[j].DisplayOrder })
	return resp.Worlds, nil
}

func (s *GameWorldService) GetAll(environmentID string) []types.GameWorld {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var resp types.GameWorldListResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil
	}
	sort.Slice(resp.Worlds, func(i, j int) bool { return resp.Worlds[i].DisplayOrder < resp.Worlds[j].DisplayOrder })
	return resp.Worlds
}

func (s *GameWorldService) GetByWorldID(worldID, environmentID string) *types.GameWorld {
	worlds := s.GetAll(environmentID)
	for _, w := range worlds {
		if w.WorldID == worldID {
			return &w
		}
	}
	return nil
}

func (s *GameWorldService) IsWorldMaintenanceActive(worldID, environmentID string) bool {
	world := s.GetByWorldID(worldID, environmentID)
	if world == nil || !world.IsMaintenance {
		return false
	}
	now := time.Now().UTC()
	if world.MaintenanceStartDate != nil {
		start, err := time.Parse(time.RFC3339, *world.MaintenanceStartDate)
		if err == nil && now.Before(start) {
			return false
		}
	}
	if world.MaintenanceEndDate != nil {
		end, err := time.Parse(time.RFC3339, *world.MaintenanceEndDate)
		if err == nil && now.After(end) {
			return false
		}
	}
	return true
}

func (s *GameWorldService) GetWorldMaintenanceMessage(worldID, environmentID, lang string) string {
	if lang == "" {
		lang = "en"
	}
	world := s.GetByWorldID(worldID, environmentID)
	if world == nil || !s.IsWorldMaintenanceActive(worldID, environmentID) {
		return ""
	}
	for _, locale := range world.MaintenanceLocales {
		if locale.Lang == lang {
			return locale.Message
		}
	}
	return world.MaintenanceMessage
}
