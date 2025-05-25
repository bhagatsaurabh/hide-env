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
	mux.HandleFunc("/api/provision", handlers.StatHandler)

	return &Server{Router: mux}
}
