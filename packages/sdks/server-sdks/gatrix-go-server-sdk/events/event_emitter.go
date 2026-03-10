package events

import (
	"sync"

	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// EventEmitter provides On/Off/Emit for SDK events with wildcard support
type EventEmitter struct {
	listeners map[string][]types.EventCallback
	mu        sync.RWMutex
}

// NewEventEmitter creates a new event emitter
func NewEventEmitter() *EventEmitter {
	return &EventEmitter{
		listeners: make(map[string][]types.EventCallback),
	}
}

// On registers a callback for an event type. Use "*" for wildcard.
func (e *EventEmitter) On(eventType string, callback types.EventCallback) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.listeners[eventType] = append(e.listeners[eventType], callback)
}

// Off removes all callbacks for an event type
func (e *EventEmitter) Off(eventType string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.listeners, eventType)
}

// Emit fires an event to all registered listeners
func (e *EventEmitter) Emit(event types.SdkEvent) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Fire specific listeners
	if cbs, ok := e.listeners[event.Type]; ok {
		for _, cb := range cbs {
			go cb(event)
		}
	}

	// Fire wildcard listeners
	if cbs, ok := e.listeners["*"]; ok {
		for _, cb := range cbs {
			go cb(event)
		}
	}
}
