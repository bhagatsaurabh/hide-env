package handlers

import (
	"context"
	"encoding/json"
	"hideenv/filesystem/services"
	"log"

	"github.com/redis/go-redis/v9"
)

const (
	AddWatchChannel    = "add-watch"
	RemoveWatchChannel = "remove-watch"
)

type WatchRequest struct {
	Uid  string `json:"uid"`
	Path string `json:"path"`
}
type AddWatchRequest struct {
	Pattern string       `json:"pattern"`
	Data    WatchRequest `json:"data"`
}
type RemoveWatchRequest struct {
	Pattern string       `json:"pattern"`
	Data    WatchRequest `json:"data"`
}

func HandleWatchChannels(ctx context.Context, wm *services.WatchManager, redis *redis.Client) {
	pubsub := redis.Subscribe(ctx, AddWatchChannel, RemoveWatchChannel)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		log.Println("Received add-watch ", msg.Payload)
		switch msg.Channel {
		case AddWatchChannel:
			var req AddWatchRequest
			if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
				log.Println("bad add-watch payload:", err)
				continue
			}
			if err := wm.AddWatch(req.Data.Uid, req.Data.Path); err != nil {
				log.Println("failed to add watch:", err)
			}
		case RemoveWatchChannel:
			var req RemoveWatchRequest
			if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
				log.Println("bad remove-watch payload:", err)
				continue
			}
			wm.RemoveWatch(req.Data.Uid, req.Data.Path)
		}
	}
}
