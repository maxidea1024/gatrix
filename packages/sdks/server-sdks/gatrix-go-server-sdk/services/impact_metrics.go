package services

import (
	"sync"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// ImpactMetricsService provides counter, gauge, histogram metrics
type ImpactMetricsService struct {
	apiClient    *client.ApiClient
	logger       types.Logger
	counters     map[string]*counterMetric
	gauges       map[string]*gaugeMetric
	histograms   map[string]*histogramMetric
	staticLabels map[string]string
	mu           sync.RWMutex
	flushTicker  *time.Ticker
	stopChan     chan struct{}
}

type counterMetric struct {
	name, help string
	value      float64
}

type gaugeMetric struct {
	name, help string
	value      float64
}

type histogramMetric struct {
	name, help string
	buckets    []float64
	values     []float64
	count      int
	sum        float64
}

func NewImpactMetricsService(apiClient *client.ApiClient, logger types.Logger, appName, service string) *ImpactMetricsService {
	return &ImpactMetricsService{
		apiClient:  apiClient,
		logger:     logger,
		counters:   make(map[string]*counterMetric),
		gauges:     make(map[string]*gaugeMetric),
		histograms: make(map[string]*histogramMetric),
		staticLabels: map[string]string{
			"appName": appName,
			"service": service,
		},
	}
}

func (s *ImpactMetricsService) DefineCounter(name, help string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.counters[name]; !exists {
		s.counters[name] = &counterMetric{name: name, help: help}
	}
}

func (s *ImpactMetricsService) DefineGauge(name, help string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.gauges[name]; !exists {
		s.gauges[name] = &gaugeMetric{name: name, help: help}
	}
}

func (s *ImpactMetricsService) DefineHistogram(name, help string, buckets []float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if buckets == nil {
		buckets = []float64{10, 25, 50, 100, 200, 500, 1000, 2000, 5000}
	}
	if _, exists := s.histograms[name]; !exists {
		s.histograms[name] = &histogramMetric{name: name, help: help, buckets: buckets}
	}
}

func (s *ImpactMetricsService) IncrementCounter(name string, value ...float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.counters[name]
	if !ok {
		return
	}
	delta := 1.0
	if len(value) > 0 {
		delta = value[0]
	}
	c.value += delta
}

func (s *ImpactMetricsService) UpdateGauge(name string, value float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	g, ok := s.gauges[name]
	if !ok {
		return
	}
	g.value = value
}

func (s *ImpactMetricsService) ObserveHistogram(name string, value float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	h, ok := s.histograms[name]
	if !ok {
		return
	}
	h.values = append(h.values, value)
	h.count++
	h.sum += value
}

func (s *ImpactMetricsService) StartCollection(intervalMs int) {
	if intervalMs <= 0 {
		intervalMs = 60000
	}
	s.flushTicker = time.NewTicker(time.Duration(intervalMs) * time.Millisecond)
	s.stopChan = make(chan struct{})
	go func() {
		for {
			select {
			case <-s.flushTicker.C:
				s.Flush()
			case <-s.stopChan:
				return
			}
		}
	}()
}

func (s *ImpactMetricsService) StopCollection() {
	if s.flushTicker != nil {
		s.flushTicker.Stop()
	}
	if s.stopChan != nil {
		close(s.stopChan)
	}
	s.Flush()
}

func (s *ImpactMetricsService) Flush() {
	s.mu.Lock()
	collected := s.collect()
	s.mu.Unlock()
	if len(collected) == 0 {
		return
	}
	payload := map[string]interface{}{
		"metrics": collected, "labels": s.staticLabels,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	_, err := s.apiClient.Post("/api/v1/server/impact-metrics", payload)
	if err != nil {
		s.logger.Error("Failed to flush impact metrics", map[string]interface{}{"error": err.Error()})
	}
}

func (s *ImpactMetricsService) collect() []map[string]interface{} {
	var result []map[string]interface{}
	for _, c := range s.counters {
		if c.value > 0 {
			result = append(result, map[string]interface{}{
				"name": c.name, "help": c.help, "type": "counter",
				"samples": []map[string]interface{}{{"labels": s.staticLabels, "value": c.value}},
			})
			c.value = 0
		}
	}
	for _, g := range s.gauges {
		result = append(result, map[string]interface{}{
			"name": g.name, "help": g.help, "type": "gauge",
			"samples": []map[string]interface{}{{"labels": s.staticLabels, "value": g.value}},
		})
		g.value = 0
	}
	for _, h := range s.histograms {
		if h.count > 0 {
			bucketCounts := make([]map[string]interface{}, 0)
			for _, b := range h.buckets {
				count := 0
				for _, v := range h.values {
					if v <= b {
						count++
					}
				}
				bucketCounts = append(bucketCounts, map[string]interface{}{"le": b, "count": count})
			}
			bucketCounts = append(bucketCounts, map[string]interface{}{"le": "+Inf", "count": h.count})
			result = append(result, map[string]interface{}{
				"name": h.name, "help": h.help, "type": "histogram",
				"samples": []map[string]interface{}{{
					"labels": s.staticLabels, "count": h.count, "sum": h.sum, "buckets": bucketCounts,
				}},
			})
			h.values = nil
			h.count = 0
			h.sum = 0
		}
	}
	return result
}
