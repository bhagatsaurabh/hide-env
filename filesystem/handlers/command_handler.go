//go:build linux

package handlers

import (
	"encoding/json"
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"net/http"
)

func CommandHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var commandReq services.CommandReqDTO
	err := json.NewDecoder(r.Body).Decode(&commandReq)
	if err != nil {
		util.SendAPIErr(w, http.StatusBadRequest, "Invalid request")
		return
	}

	err = services.RunCommand(commandReq)

	if err != nil {
		util.SendAPIErr(w, http.StatusInternalServerError, "Unknown error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
}
