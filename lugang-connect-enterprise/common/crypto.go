package common

import (
	"crypto/sha256"
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func DoubleSHA256Hash(password string) string {
	// 第一次SHA256哈希
	firstHash := sha256.Sum256([]byte(password))
	// 第二次SHA256哈希
	secondHash := sha256.Sum256(firstHash[:])
	return fmt.Sprintf("%x", secondHash)
}

func Password2Hash(password string) (string, error) {
	passwordBytes := []byte(password)
	hashedPassword, err := bcrypt.GenerateFromPassword(passwordBytes, bcrypt.DefaultCost)
	return string(hashedPassword), err
}

func ValidatePasswordAndHash(password string, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
