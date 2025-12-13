//go:build linux

package handlers

import (
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"log"
	"net/http"
)

func AffineHandler(w http.ResponseWriter, r *http.Request, wm *services.WatchManager) {
	if r.Method != http.MethodGet {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "INVALID_REQUEST")
		return
	}
	envId := r.URL.Query().Get("envId")
	if envId == "" {
		util.SendAPIErr(w, http.StatusBadRequest, "INVALID_REQUEST")
		return
	}

	log.Println("Got affine request", envId)
	wm.EnvInstanceId = envId

	w.WriteHeader(http.StatusOK)
}
