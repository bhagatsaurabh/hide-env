//go:build linux

package services

import (
	"errors"
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
		{
			data, ok := cmdReq.Data.(NewFileDTO)
			if !ok {
				return errors.New("Invalid command data")
			}

			file, err := os.Create(data.Path)
			if err != nil {
				return errors.New("Cannot create file")
			}
			defer file.Close()
			break
		}
	case "folder.new":
		{
			data, ok := cmdReq.Data.(NewFolderDTO)
			if !ok {
				return errors.New("Invalid command data")
			}

			err := os.Mkdir(data.Path, 0755)
			if err != nil {
				if os.IsExist(err) {
					return errors.New("Directory already exists")
				} else {
					return errors.New("Cannot create directory")
				}
			} else {
				exec.Command("chown", "-R", "devuser:devuser", data.Path)
			}
			break
		}
	default:
		break
	}
	return nil
}
