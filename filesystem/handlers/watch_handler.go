//go:build linux

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"hideenv/filesystem/services"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var uuid = os.Getenv("WS_UUID")
var (
	AffineChannel      = fmt.Sprintf("workspace.%s.affine", uuid)
	AddWatchChannel    = fmt.Sprintf("workspace.%s.watch.add", uuid)
	RemoveWatchChannel = fmt.Sprintf("workspace.%s.watch.remove", uuid)
)

type AffineRequestData struct {
	EnvInstanceId string `json:"envInstanceId"`
}
type AffineRequest struct {
	Pattern string            `json:"pattern"`
	Data    AffineRequestData `json:"data"`
}

type WatchRequestData struct {
	Path string `json:"path"`
}
type AddWatchRequest struct {
	Pattern string           `json:"pattern"`
	Data    WatchRequestData `json:"data"`
}
type RemoveWatchRequest struct {
	Pattern string           `json:"pattern"`
	Data    WatchRequestData `json:"data"`
}

func HandleWatchChannels(ctx context.Context, wm *services.WatchManager, redis *redis.Client) {
	pubsub := redis.Subscribe(ctx, AddWatchChannel, RemoveWatchChannel)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		switch msg.Channel {
		case AffineChannel:
			var req AffineRequest
			if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
				log.Println("Parse error, affine payload:", err)
				continue
			}
			wm.EnvInstanceId = req.Data.EnvInstanceId
		case AddWatchChannel:
			var req AddWatchRequest
			if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
				log.Println("Parse error, watch.add payload:", err)
				continue
			}
			if err := wm.AddWatch(req.Data.Path); err != nil {
				log.Println("Failed to add watch:", err)
			}
		case RemoveWatchChannel:
			var req RemoveWatchRequest
			if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
				log.Println("Parse error, watch.remove payload:", err)
				continue
			}
			if err := wm.RemoveWatch(req.Data.Path); err != nil {
				log.Println("Failed to remove watch:", err)
			}
		}
	}
}
