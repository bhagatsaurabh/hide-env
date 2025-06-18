//go:build linux

package server

import (
	"hideenv/filesystem/handlers"
	"net/http"
)

type Server struct {
	Router *http.ServeMux
}

func NewServer() *Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/api/stat", handlers.StatHandler)
	mux.HandleFunc("/api/dir", handlers.DirHandler)
	mux.HandleFunc("/api/hash", handlers.HashHandler)
	mux.HandleFunc("/api/read", handlers.ReadHandler)
	mux.HandleFunc("/api/write", handlers.WriteHandler)

	return &Server{Router: mux}
}
