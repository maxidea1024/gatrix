package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/types"
	"github.com/go-redis/redis/v8"
)

const RedisChannel = "gatrix-sdk-events"

type EventListenerConfig struct {
	Host, Password string
	Port, DB       int
}

type EventListener struct {
	config  EventListenerConfig
	client  *redis.Client
	pubsub  *redis.PubSub
	emitter *EventEmitter
	logger  types.Logger
	ctx     context.Context
	cancel  context.CancelFunc
}

func NewEventListener(config EventListenerConfig, emitter *EventEmitter, logger types.Logger) *EventListener {
	ctx, cancel := context.WithCancel(context.Background())
	return &EventListener{config: config, emitter: emitter, logger: logger, ctx: ctx, cancel: cancel}
}

func (l *EventListener) Start() error {
	l.client = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%d", l.config.Host, l.config.Port),
		Password: l.config.Password, DB: l.config.DB,
	})
	if err := l.client.Ping(l.ctx).Err(); err != nil {
		l.logger.Error("Failed to connect to Redis for events", map[string]interface{}{"error": err.Error()})
		return err
	}
	l.pubsub = l.client.Subscribe(l.ctx, RedisChannel)
	if _, err := l.pubsub.Receive(l.ctx); err != nil {
		return err
	}
	l.logger.Info("Redis event listener started", map[string]interface{}{"channel": RedisChannel})
	go l.listen()
	return nil
}

func (l *EventListener) Stop() {
	l.cancel()
	if l.pubsub != nil {
		_ = l.pubsub.Close()
	}
	if l.client != nil {
		_ = l.client.Close()
	}
}

func (l *EventListener) listen() {
	ch := l.pubsub.Channel()
	for {
		select {
		case <-l.ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			l.handleMessage(msg.Payload)
		}
	}
}

func (l *EventListener) handleMessage(payload string) {
	var event types.StandardEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		return
	}
	sdkEvent := types.SdkEvent{
		Type: event.Type, Data: event.Data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	l.emitter.Emit(sdkEvent)
}
