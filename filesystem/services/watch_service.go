package services

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/redis/go-redis/v9"
)

type WatchManager struct {
	Watcher   *fsnotify.Watcher
	Redis     *redis.Client
	Mu        sync.Mutex
	PathUsers map[string]map[string]struct{}
	UserPaths map[string]map[string]struct{}
}
type WatchEvent struct {
	Uids   []string `json:"uids"`
	Path   string   `json:"path"`
	Action string   `json:"action"`
	Name   string   `json:"name"`
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
		Watcher:   watcher,
		Redis:     redis,
		PathUsers: make(map[string]map[string]struct{}),
		UserPaths: make(map[string]map[string]struct{}),
	}
	return wm, nil
}

func (wm *WatchManager) AddWatch(uid, path string) error {
	log.Println("Adding watch ", uid, path)
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	if wm.PathUsers[path] == nil {
		wm.PathUsers[path] = make(map[string]struct{})
	}
	wm.PathUsers[path][uid] = struct{}{}

	if wm.UserPaths[uid] == nil {
		wm.UserPaths[uid] = make(map[string]struct{})
	}
	wm.UserPaths[uid][path] = struct{}{}

	if len(wm.PathUsers[path]) == 1 {
		err := wm.Watcher.Add(path)
		if err != nil {
			delete(wm.PathUsers, path)
			delete(wm.UserPaths[uid], path)
			return err
		}
		log.Printf("Started watching: %s\n", path)
	}
	return nil
}

func (wm *WatchManager) RemoveWatch(uid, path string) {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	if users, ok := wm.PathUsers[path]; ok {
		delete(users, uid)
		if len(users) == 0 {
			wm.Watcher.Remove(path)
			delete(wm.PathUsers, path)
			log.Printf("Stopped watching: %s\n", path)
		}
	}
	if paths, ok := wm.UserPaths[uid]; ok {
		delete(paths, path)
		if len(paths) == 0 {
			delete(wm.UserPaths, uid)
		}
	}
}

func (wm *WatchManager) Start(ctx context.Context) {
	go wm.handleEvents(ctx)
}

func (wm *WatchManager) handleEvents(ctx context.Context) {
	for {
		log.Println("handling...")
		select {
		case event, ok := <-wm.Watcher.Events:
			log.Println("Got event", ok, event)
			if !ok {
				return
			}
			wm.processEvent(ctx, event)
		case err, ok := <-wm.Watcher.Errors:
			if !ok {
				return
			}
			log.Println("watcher error:", err)
		case <-ctx.Done():
			log.Println("shutting down event handler")
			return
		}
	}
}

func (wm *WatchManager) processEvent(ctx context.Context, event fsnotify.Event) {
	wm.Mu.Lock()
	defer wm.Mu.Unlock()

	dirPath := event.Name

	uids := []string{}
	if users, ok := wm.PathUsers[dirPath]; ok {
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
		action = "modify"
	}

	evt := WatchEvent{
		Uids:   uids,
		Path:   dirPath,
		Action: action,
		Name:   event.Name,
	}

	payload, err := json.Marshal(evt)
	if err != nil {
		log.Println("failed to marshal event:", err)
		return
	}

	wm.Redis.Publish(ctx, WatchEventChannel, payload)
}
