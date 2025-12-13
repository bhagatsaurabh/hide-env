//go:build linux

package handlers

import (
	"encoding/json"
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"net/http"
)

func WriteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "INVALID_REQUEST")
		return
	}
	path := r.URL.Query().Get("path")
	if path == "" {
		util.SendAPIErr(w, http.StatusBadRequest, "BAD_WRITE_QUERY")
		return
	}

	var writeReq services.WriteDTO
	err := json.NewDecoder(r.Body).Decode(&writeReq)
	if err != nil {
		util.SendAPIErr(w, http.StatusBadRequest, "INVALID_REQUEST")
		return
	}

	err = services.WriteContent(path, writeReq)

	if err != nil {
		util.SendAPIErr(w, http.StatusInternalServerError, "UNKNOWN")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
}
