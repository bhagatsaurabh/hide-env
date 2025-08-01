//go:build linux

/* var req AffineRequest
log.Println("Got affine request")
if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
	log.Println("Parse error, affine payload:", err)
	continue
}

log.Println(wm.EnvInstanceId) */

package handlers

import (
	"hideenv/filesystem/services"
	"hideenv/filesystem/util"
	"net/http"
)

func AffineHandler(w http.ResponseWriter, r *http.Request, wm *services.WatchManager) {
	if r.Method != http.MethodGet {
		util.SendAPIErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	envId := r.URL.Query().Get("envId")
	if envId == "" {
		util.SendAPIErr(w, http.StatusBadRequest, "Invalid request")
		return
	}

	wm.EnvInstanceId = envId

	w.WriteHeader(http.StatusOK)
}
