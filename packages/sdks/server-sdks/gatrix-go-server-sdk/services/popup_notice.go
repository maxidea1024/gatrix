package services

import (
	"encoding/json"
	"sort"
	"strings"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// PopupNoticeService handles popup notices
type PopupNoticeService struct {
	*BaseEnvironmentService
}

func NewPopupNoticeService(apiClient *client.ApiClient, logger types.Logger, defaultEnvID string) *PopupNoticeService {
	return &PopupNoticeService{BaseEnvironmentService: NewBaseEnvironmentService(apiClient, logger, defaultEnvID)}
}

func (s *PopupNoticeService) FetchByEnvironment(environmentID string) ([]types.PopupNotice, error) {
	data, err := s.BaseEnvironmentService.FetchAndCache("/api/v1/server/popup-notices", environmentID)
	if err != nil {
		return nil, err
	}
	var notices []types.PopupNotice
	if err := json.Unmarshal(data, &notices); err != nil {
		return nil, err
	}
	return notices, nil
}

func (s *PopupNoticeService) GetAll(environmentID string) []types.PopupNotice {
	raw := s.GetCachedRaw(environmentID)
	if raw == nil {
		return nil
	}
	var notices []types.PopupNotice
	_ = json.Unmarshal(raw, &notices)
	return notices
}

func (s *PopupNoticeService) GetActive(environmentID, platform, channel, worldID, userID string) []types.PopupNotice {
	all := s.GetAll(environmentID)
	now := time.Now().UTC()
	var result []types.PopupNotice
	for _, n := range all {
		if n.EndDate != nil {
			end, err := time.Parse(time.RFC3339, *n.EndDate)
			if err == nil && now.After(end) {
				continue
			}
		}
		if n.StartDate != nil {
			start, err := time.Parse(time.RFC3339, *n.StartDate)
			if err == nil && now.Before(start) {
				continue
			}
		}
		if !matchesTarget(n.TargetWorlds, worldID, n.TargetWorldsInverted) {
			continue
		}
		if !matchesTarget(n.TargetPlatforms, platform, n.TargetPlatformsInverted) {
			continue
		}
		if !matchesTarget(n.TargetChannels, channel, n.TargetChannelsInverted) {
			continue
		}
		if !matchesTarget(n.TargetUserIDs, userID, n.TargetUserIDsInverted) {
			continue
		}
		result = append(result, n)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].DisplayPriority < result[j].DisplayPriority })
	return result
}

func matchesTarget(targets []string, value string, inverted *bool) bool {
	if len(targets) == 0 || value == "" {
		return true
	}
	found := false
	for _, t := range targets {
		if strings.EqualFold(t, value) {
			found = true
			break
		}
	}
	inv := inverted != nil && *inverted
	if inv {
		return !found
	}
	return found
}
