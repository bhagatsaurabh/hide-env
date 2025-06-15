//go:build linux

package handlers

import (
	"encoding/json"
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"net/http"
)

func ReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	path := r.URL.Query().Get("path")
	if path == "" {
		util.SendAPIErr(w, http.StatusBadRequest, "Invalid request")
		return
	}

	var readRes services.ReadDTO
	readRes, err := services.GetContent(path)

	if err != nil {
		util.SendAPIErr(w, http.StatusBadRequest, "Unknown error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(readRes)
}
