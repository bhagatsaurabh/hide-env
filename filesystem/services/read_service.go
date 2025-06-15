//go:build linux

package services

import (
	"os"
)

type ReadDTO struct {
	Content string `json:"content"`
}

func GetContent(path string) (ReadDTO, error) {
	res := ReadDTO{
		Content: "",
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return res, err
	}
	res.Content = string(data)
	return res, nil
}
