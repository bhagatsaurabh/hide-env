//go:build linux

package services

import (
	"errors"
	"os"
)

type StatDTO struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"isDir"`
}

func GetStat(path string, statRes *StatDTO) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.New("Path does not exist")
		} else {
			return errors.New("Cannot stat path")
		}
	}

	statRes.Name = info.Name()
	statRes.Size = info.Size()
	statRes.IsDir = info.IsDir()

	return err
}
