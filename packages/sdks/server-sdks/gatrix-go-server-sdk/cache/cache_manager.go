package cache

import (
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/types"
)

type RefreshFunc func(environmentID string) error

type ServiceRefresher struct {
	Name    string
	Refresh RefreshFunc
}

type CacheManager struct {
	logger       types.Logger
	refreshers   []ServiceRefresher
	environments []string
	ticker       *time.Ticker
	stopChan     chan struct{}
}

func NewCacheManager(logger types.Logger) *CacheManager {
	return &CacheManager{logger: logger, stopChan: make(chan struct{})}
}

func (m *CacheManager) AddRefresher(name string, fn RefreshFunc) {
	m.refreshers = append(m.refreshers, ServiceRefresher{Name: name, Refresh: fn})
}

func (m *CacheManager) SetEnvironments(envs []string) { m.environments = envs }

func (m *CacheManager) Start(intervalSeconds int) {
	if intervalSeconds <= 0 {
		intervalSeconds = 300
	}
	m.ticker = time.NewTicker(time.Duration(intervalSeconds) * time.Second)
	m.logger.Info("Cache manager started", map[string]interface{}{
		"intervalSeconds": intervalSeconds, "services": len(m.refreshers),
	})
	go func() {
		for {
			select {
			case <-m.ticker.C:
				m.RefreshAll()
			case <-m.stopChan:
				return
			}
		}
	}()
}

func (m *CacheManager) Stop() {
	if m.ticker != nil {
		m.ticker.Stop()
	}
	close(m.stopChan)
}

func (m *CacheManager) RefreshAll() {
	for _, refresher := range m.refreshers {
		for _, env := range m.environments {
			if err := refresher.Refresh(env); err != nil {
				m.logger.Warn("Cache refresh failed", map[string]interface{}{
					"service": refresher.Name, "envId": env, "error": err.Error(),
				})
			}
		}
	}
}
