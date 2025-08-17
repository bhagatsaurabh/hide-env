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
		log.Println("file.new")
		var ctx NewFileDTO
		jsonBytes, _ := json.Marshal(cmdReq.Data)
		json.Unmarshal(jsonBytes, &ctx)

		ctx.Path = "/workspace" + ctx.Path

		log.Println(ctx.Path)
		file, err := os.Create(ctx.Path)
		log.Println("Done")
		if err != nil {
			return errors.New("Cannot create file")
		}
		log.Println("Almost")
		defer file.Close()
		log.Println("Over")
	case "folder.new":

		var ctx NewFolderDTO
		jsonBytes, _ := json.Marshal(cmdReq.Data)
		json.Unmarshal(jsonBytes, &ctx)

		ctx.Path = "/workspace" + ctx.Path

		err := os.Mkdir(ctx.Path, 0755)
		if err != nil {
			if os.IsExist(err) {
				return errors.New("Directory already exists")
			} else {
				return errors.New("Cannot create directory")
			}
		} else {
			cmd := exec.Command("chown", "-R", "devuser:devuser", ctx.Path)
			if err := cmd.Run(); err != nil {
				return errors.New("Failed to set new directory permissions")
			}
		}
	}
	log.Println("Returning")
	return nil
}
