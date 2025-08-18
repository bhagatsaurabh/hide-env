//go:build linux

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/fsnotify/fsnotify"
	uuidv4 "github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type WatchManager struct {
	Watcher       *fsnotify.Watcher
	Redis         *redis.Client
	Mu            sync.Mutex
	Paths         map[string]bool
	EnvInstanceId string
}

type WatchEvent struct {
	WatchedPath string  `json:"watchedPath"`
	Action      string  `json:"action"`
	Path        string  `json:"path"`
	OldPath     string  `json:"oldPath,omitempty"`
	Timestamp   int64   `json:"timestamp"`
	Ino         *uint64 `json:"ino,omitempty"`
	Type        string  `json:"type"`
}
type WatchEventPayload struct {
	Event WatchEvent `json:"event"`
	Uuid  string     `json:"uuid"`
}
type WatchChannelPayload struct {
	Service string            `json:"service"`
	Action  string            `json:"action"`
	Payload WatchEventPayload `json:"payload"`
}
type WatchChannelMessage struct {
	Payload WatchChannelPayload `json:"payload"`
}
type InternalMessage[T any] struct {
	Id   string `json:"id"`
	Data T      `json:"data"`
}

var uuid = os.Getenv("WS_UUID")

func NewWatchManager(redis *redis.Client) (*WatchManager, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	wm := &WatchManager{
		Watcher: watcher,
		Redis:   redis,
		Paths:   make(map[string]bool),
	}
	return wm, nil
}

func (wm *WatchManager) AddWatch(watchPath string) error {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	watchPath = path.Clean(watchPath)
	if wm.Paths[watchPath] {
		return nil
	}

	err := wm.Watcher.Add(watchPath)
	if err != nil {
		log.Println("Failed to add watcher:", err)
		return err
	}
	wm.Paths[watchPath] = true
	log.Println("Watcher added:", watchPath)
	return nil
}

func (wm *WatchManager) RemoveWatch(watchPath string) error {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	watchPath = path.Clean(watchPath)
	if !wm.Paths[watchPath] {
		return nil
	}

	err := wm.Watcher.Remove(watchPath)
	if err != nil {
		log.Println("Failed to remove watcher:", err)
		return err
	}
	delete(wm.Paths, watchPath)
	log.Println("Watcher removed:", watchPath)
	return nil
}

func (wm *WatchManager) Start(ctx context.Context) {
	go wm.handleEvents(ctx)
}

func (wm *WatchManager) handleEvents(ctx context.Context) {
	for {
		select {
		case event, ok := <-wm.Watcher.Events:
			if !ok {
				return
			}
			wm.processEvent(ctx, event)
		case err, ok := <-wm.Watcher.Errors:
			if !ok {
				return
			}
			log.Println("Watcher error:", err)
		case <-ctx.Done():
			return
		}
	}
}

func (wm *WatchManager) processEvent(ctx context.Context, event fsnotify.Event) {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	watchedPath := filepath.Dir(event.Name)

	action := "unknown"
	if event.Op&fsnotify.Create == fsnotify.Create {
		action = "create"
	} else if event.Op&fsnotify.Remove == fsnotify.Remove {
		action = "remove"
	} else if event.Op&fsnotify.Rename == fsnotify.Rename {
		action = "rename"
	} else if event.Op&fsnotify.Write == fsnotify.Write {
		action = "write"
	}

	msg := InternalMessage[WatchChannelMessage]{
		Id: uuidv4.NewString(),
		Data: WatchChannelMessage{
			Payload: WatchChannelPayload{
				Service: "internal",
				Action:  "workspace.watch",
				Payload: WatchEventPayload{
					Uuid: uuid,
					Event: WatchEvent{
						WatchedPath: watchedPath,
						Action:      action,
						Path:        event.Name,
						Timestamp:   time.Now().UnixMilli(),
					},
				},
			},
		},
	}

	if action != "remove" {
		info, err := os.Lstat(event.Name)
		if err == nil {
			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				msg.Data.Payload.Payload.Event.Ino = &stat.Ino
				if info.IsDir() {
					msg.Data.Payload.Payload.Event.Type = "dir"
				} else {
					msg.Data.Payload.Payload.Event.Type = "file"
				}
			}
		}
	}
	eventStr := event.String()
	sepIndex := strings.Index(eventStr, "←")
	if sepIndex != -1 {
		oldPath := eventStr[sepIndex+5 : len(eventStr)-1]
		msg.Data.Payload.Payload.Event.OldPath = oldPath
	}

	sMsg, err := json.Marshal(msg)
	if err != nil {
		log.Println("Encode error: ", err)
		return
	}

	wm.Redis.Publish(ctx, fmt.Sprintf("env.%s", wm.EnvInstanceId), sMsg)

	if wm.EnvInstanceId == "" {
		log.Println("Event without destination")
	}
}
