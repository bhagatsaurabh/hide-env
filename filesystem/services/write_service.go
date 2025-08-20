//go:build linux

package services

import (
	"os"
)

type WriteDTO struct {
	Content string `json:"content"`
}

func WriteContent(path string, writeReq WriteDTO) error {
	content := []byte(writeReq.Content)

	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return nil
	}

	err = os.WriteFile(path, content, 0777)
	if err != nil {
		return err
	}
	return nil
}
