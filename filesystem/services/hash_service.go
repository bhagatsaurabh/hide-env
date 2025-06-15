//go:build linux

package services

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
)

type HashDTO struct {
	Hex string `json:"hex"`
}

func GetHash(path string) (HashDTO, error) {
	res := HashDTO{
		Hex: "",
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return res, err
	}

	hash := sha256.Sum256(content)
	res.Hex = hex.EncodeToString(hash[:])
	return res, nil
}
