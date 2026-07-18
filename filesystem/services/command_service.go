//go:build linux

package services

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"os/exec"
)

type CommandReqDTO struct {
	Command string `json:"command"`
	Data    any    `json:"data"`
}
type NewFileDTO struct {
	Path string `json:"path"`
}
type NewFolderDTO struct {
	Path string `json:"path"`
}

func RunCommand(cmdReq CommandReqDTO) error {
	switch cmdReq.Command {
	case "file.new":
		var ctx NewFileDTO
		jsonBytes, _ := json.Marshal(cmdReq.Data)
		json.Unmarshal(jsonBytes, &ctx)

		ctx.Path = "/workspace" + ctx.Path

		file, err := os.Create(ctx.Path)
		if err != nil {
			log.Println("File creation error", err)
			return errors.New("Cannot create file")
		}
		defer file.Close()
	case "folder.new":

		var ctx NewFolderDTO
		jsonBytes, _ := json.Marshal(cmdReq.Data)
		json.Unmarshal(jsonBytes, &ctx)

		ctx.Path = "/workspace" + ctx.Path

		err := os.Mkdir(ctx.Path, 0755)
		if err != nil {
			log.Println("Directory op error", err)
			if os.IsExist(err) {
				return errors.New("Directory already exists")
			} else {
				return errors.New("Cannot create directory")
			}
		} else {
			cmd := exec.Command("chown", "-R", "devuser:devuser", ctx.Path)
			if err := cmd.Run(); err != nil {
				log.Println("Permission set error", err)
				return errors.New("Failed to set new directory permissions")
			}
		}
	}
	return nil
}
