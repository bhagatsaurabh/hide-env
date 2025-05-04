//go:build linux

package services

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/redis/go-redis/v9"
)

type WatchManager struct {
	Watcher      *fsnotify.Watcher
	Redis        *redis.Client
	Mu           sync.Mutex
	PathToUidMap map[string]map[string]bool
	UidToPathMap map[string]map[string]bool
}
type WatchEvent struct {
	Uids        []string `json:"uids"`
	WatchedPath string   `json:"watchedPath"`
	Action      string   `json:"action"`
	Path        string   `json:"path"`
	OldPath     string   `json:"oldPath,omitempty"`
	Timestamp   int64    `json:"timestamp"`
	Ino         *uint64  `json:"ino,omitempty"`
	Type        string   `json:"type"`
}

const (
	WatchEventChannel = "watch-event"
)

func NewWatchManager(redis *redis.Client) (*WatchManager, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	wm := &WatchManager{
		Watcher:      watcher,
		Redis:        redis,
		PathToUidMap: make(map[string]map[string]bool),
		UidToPathMap: make(map[string]map[string]bool),
	}
	return wm, nil
}

func (wm *WatchManager) AddWatch(uid, watchPath string) error {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	watchPath = path.Clean(watchPath)

	if wm.PathToUidMap[watchPath] == nil {
		wm.PathToUidMap[watchPath] = make(map[string]bool)
	}
	wm.PathToUidMap[watchPath][uid] = true

	if wm.UidToPathMap[uid] == nil {
		wm.UidToPathMap[uid] = make(map[string]bool)
	}
	wm.UidToPathMap[uid][watchPath] = true

	if len(wm.PathToUidMap[watchPath]) == 1 {
		err := wm.Watcher.Add(watchPath)
		if err != nil {
			delete(wm.PathToUidMap[watchPath], uid)
			delete(wm.UidToPathMap[uid], watchPath)
			return err
		}
	}
	return nil
}

func (wm *WatchManager) RemoveWatch(uid, watchPath string) {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	watchPath = path.Clean(watchPath)

	pathsToRemove := []string{}
	for watchedPath := range wm.PathToUidMap {
		if isSubpath(watchPath, watchedPath) {
			pathsToRemove = append(pathsToRemove, watchedPath)
		}
	}

	for _, watchedPath := range pathsToRemove {
		delete(wm.PathToUidMap[watchedPath], uid)
		if len(wm.PathToUidMap[watchedPath]) == 0 {
			if err := wm.Watcher.Remove(watchedPath); err != nil {
				log.Println("Failed to remove watcher:", err)
			}
			delete(wm.PathToUidMap, watchedPath)
		}
	}

	if userPaths, ok := wm.UidToPathMap[uid]; ok {
		for p := range userPaths {
			if isSubpath(watchPath, p) {
				delete(userPaths, p)
			}
		}
		if len(userPaths) == 0 {
			delete(wm.UidToPathMap, uid)
		}
	}
}

func isSubpath(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	joined := filepath.Join(parent, rel)
	return joined == child
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

	uids := []string{}
	if users, ok := wm.PathToUidMap[watchedPath]; ok {
		for uid := range users {
			uids = append(uids, uid)
		}
	} else {
		return
	}

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

	evt := WatchEvent{
		Uids:        uids,
		WatchedPath: watchedPath,
		Action:      action,
		Path:        event.Name,
		Timestamp:   time.Now().Unix(),
	}

	if action != "remove" {
		info, err := os.Lstat(event.Name)
		if err == nil {
			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				evt.Ino = &stat.Ino
				if info.IsDir() {
					evt.Type = "dir"
				} else {
					evt.Type = "file"
				}
			}
		}
	}
	eventStr := event.String()
	log.Println(eventStr)
	sepIndex := strings.Index(eventStr, "←")
	if sepIndex != -1 {
		oldPath := eventStr[sepIndex+5 : len(eventStr)-1]
		evt.OldPath = oldPath
	}

	payload, err := json.Marshal(evt)
	if err != nil {
		log.Println("Encode error: ", err)
		return
	}

	wm.Redis.Publish(ctx, WatchEventChannel, payload)
}
