//go:build linux

package handlers

import (
	"encoding/json"
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"net/http"
)

func HashHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "INVALID_REQUEST")
		return
	}
	path := r.URL.Query().Get("path")
	if path == "" {
		util.SendAPIErr(w, http.StatusBadRequest, "BAD_HASH_QUERY")
		return
	}

	var hashRes services.HashDTO
	hashRes, err := services.GetHash(path)

	if err != nil {
		util.SendAPIErr(w, http.StatusBadRequest, "UNKNOWN")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(hashRes)
}
