//go:build linux

package services

import (
	"errors"
	"os"
	"syscall"
)

type StatDTO struct {
	Name  string  `json:"name"`
	Size  int64   `json:"size"`
	IsDir bool    `json:"isDir"`
	Ino   *uint64 `json:"ino"`
}

func GetStat(path string, statRes *StatDTO) error {
	info, err := os.Lstat(path)
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
	stat, _ := info.Sys().(*syscall.Stat_t)
	statRes.Ino = &stat.Ino

	return err
}
