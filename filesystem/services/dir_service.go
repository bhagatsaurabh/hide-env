//go:build linux

package services

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

type DirDTO struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Id    uint64 `json:"id"`
}

func GetDir(path string) ([]DirDTO, error) {
	entries := []DirDTO{}

	dirEntries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range dirEntries {
		fullPath := filepath.Join(path, entry.Name())

		info, err := entry.Info()
		if err != nil {
			return nil, err
		}

		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok {
			return nil, fmt.Errorf("failed to get raw stat for %s", fullPath)
		}

		entries = append(entries, DirDTO{
			Name:  entry.Name(),
			Path:  fullPath,
			IsDir: entry.IsDir(),
			Id:    stat.Ino,
		})
	}

	return entries, nil
}
