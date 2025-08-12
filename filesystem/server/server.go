//go:build linux

package server

import (
	"hideenv/filesystem/handlers"
	"hideenv/filesystem/services"
	"net/http"
)

type Server struct {
	Router *http.ServeMux
}

func NewServer(wm *services.WatchManager) *Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/api/stat", handlers.StatHandler)
	mux.HandleFunc("/api/dir", handlers.DirHandler)
	mux.HandleFunc("/api/hash", handlers.HashHandler)
	mux.HandleFunc("/api/read", handlers.ReadHandler)
	mux.HandleFunc("/api/write", handlers.WriteHandler)
	mux.HandleFunc("/api/command", handlers.CommandHandler)
	mux.HandleFunc("/api/affine", func(w http.ResponseWriter, r *http.Request) {
		handlers.AffineHandler(w, r, wm)
	})

	return &Server{Router: mux}
}
